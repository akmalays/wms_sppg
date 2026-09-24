import React, { useState } from 'react';
import { warehouseDb } from '../db/storage';
import { InventoryTransaction, ReceivingDocument, TransactionType } from '../types/warehouse';
import { Search, History, ArrowDownLeft, ArrowUpRight, SlidersHorizontal, ExternalLink, Calendar } from 'lucide-react';
import { ReceivingDetailModal } from './ReceivingDetailModal';

export const StockMovementModule: React.FC = () => {
  const [transactions] = useState<InventoryTransaction[]>(() => warehouseDb.getTransactions());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [selectedReceivingDoc, setSelectedReceivingDoc] = useState<ReceivingDocument | null>(null);

  const handleRefClick = (refDoc: string) => {
    if (refDoc.startsWith('GR-')) {
      const doc = warehouseDb.getReceivingById(refDoc);
      if (doc) {
        setSelectedReceivingDoc(doc);
      } else {
        alert(`Dokumen referensi ${refDoc} tidak ditemukan.`);
      }
    } else {
      alert(`Dokumen referensi: ${refDoc}\n(Transaksi tercatat di buku besar SPPG Jeru Tumpang).`);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      tx.id.toLowerCase().includes(q) ||
      tx.itemName.toLowerCase().includes(q) ||
      tx.referenceDocument.toLowerCase().includes(q) ||
      tx.userName.toLowerCase().includes(q) ||
      (tx.notes && tx.notes.toLowerCase().includes(q));

    const matchesType = filterType === 'ALL' || tx.transactionType === filterType;

    return matchesSearch && matchesType;
  });

  const getTransactionBadge = (type: TransactionType) => {
    switch (type) {
      case 'RECEIVING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <ArrowDownLeft className="w-3 h-3" /> Penerimaan
          </span>
        );
      case 'ISSUE_CONSUMPTION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <ArrowUpRight className="w-3 h-3" /> Pengeluaran
          </span>
        );
      case 'STOCK_OPNAME_ADJUSTMENT':
      case 'ADJUSTMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <SlidersHorizontal className="w-3 h-3" /> Opname Adj.
          </span>
        );
      default:
        return <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Detail Modal */}
      <ReceivingDetailModal
        document={selectedReceivingDoc}
        onClose={() => setSelectedReceivingDoc(null)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Buku Besar Mutasi Stok (Inventory Ledger)</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              Traceable & Immutable
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Setiap perubahan stok tercatat secara permanen dan dapat ditelusuri ke dokumen sumber (GR/SO/Issue).
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari transaksi, item, referensi dokumen, atau nama staf..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">Semua Jenis Mutasi</option>
            <option value="RECEIVING">RECEIVING (Penerimaan)</option>
            <option value="ISSUE_CONSUMPTION">ISSUE / CONSUMPTION (Pengeluaran Dapur)</option>
            <option value="STOCK_OPNAME_ADJUSTMENT">STOCK OPNAME ADJUSTMENT</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Tanggal & Jam</th>
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-4">Jenis Mutasi</th>
                <th className="py-3 px-4 text-right">Kuantitas</th>
                <th className="py-3 px-4 text-right">Saldo Setelah</th>
                <th className="py-3 px-4">Dokumen Referensi</th>
                <th className="py-3 px-4">PIC / User</th>
                <th className="py-3 px-4">Lokasi & Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                    Belum ada riwayat transaksi mutasi stok yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => {
                  const isPositive = tx.quantity > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{tx.timestamp.split(' ')[0]}</div>
                        <div className="text-slate-400 text-[10px]">{tx.timestamp.split(' ')[1]} WIB</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{tx.itemName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{tx.itemId}</div>
                      </td>
                      <td className="py-3 px-4">{getTransactionBadge(tx.transactionType)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span
                          className={`text-sm ${
                            isPositive ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {isPositive ? `+${tx.quantity}` : tx.quantity}
                        </span>{' '}
                        <span className="text-[11px] text-slate-500 font-normal">{tx.unit}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                        {tx.balanceAfter} {tx.unit}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleRefClick(tx.referenceDocument)}
                          className="inline-flex items-center gap-1 font-mono text-emerald-700 hover:text-emerald-800 hover:underline text-[11px] font-bold cursor-pointer"
                          title="Klik untuk melihat dokumen referensi sumber"
                        >
                          {tx.referenceDocument}
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{tx.userName}</div>
                        <div className="text-[10px] text-slate-400">{tx.userRole}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="text-[11px] font-medium text-slate-700 truncate">{tx.location}</div>
                        {tx.notes && <div className="text-[10px] text-slate-500 italic truncate">{tx.notes}</div>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
