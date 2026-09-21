import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { ItemCategory, ItemMaster, ItemType, StockStatus, BaseUnit } from '../types/warehouse';
import { Search, Plus, Filter, AlertTriangle, CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight, Edit2, X } from 'lucide-react';

interface InventoryModuleProps {
  onRefreshData?: () => void;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({ onRefreshData }) => {
  const { currentUser, can } = useAuth();

  const [items, setItems] = useState<ItemMaster[]>(() => warehouseDb.getItems());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modals
  const [editingItem, setEditingItem] = useState<ItemMaster | null>(null);
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [consumingItem, setConsumingItem] = useState<ItemMaster | null>(null);

  // Consumption Form State
  const [consumeQty, setConsumeQty] = useState<number>(1);
  const [consumeNotes, setConsumeNotes] = useState('');
  const [consumeLocation, setConsumeLocation] = useState('Dapur Utama - Pengolahan');

  // Item Form State
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formItemType, setFormItemType] = useState<ItemType>('FOOD_CARRYING_STOCK');
  const [formCategory, setFormCategory] = useState<ItemCategory>('Sembako');
  const [formSubcategory, setFormSubcategory] = useState('');
  const [formBaseUnit, setFormBaseUnit] = useState<BaseUnit>('Kg');
  const [formMinStock, setFormMinStock] = useState<number>(10);
  const [formReorderPoint, setFormReorderPoint] = useState<number>(25);
  const [formLocation, setFormLocation] = useState('Gudang Kering - Rak A');
  const [formExpiryTracking, setFormExpiryTracking] = useState<boolean>(true);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  const refreshData = () => {
    setItems(warehouseDb.getItems());
    if (onRefreshData) onRefreshData();
  };

  const getItemStockStatus = (item: ItemMaster): StockStatus => {
    if (item.currentStock <= 0) return 'OUT_OF_STOCK';
    if (item.currentStock <= item.minimumStock) return 'LOW';
    return 'NORMAL';
  };

  const handleOpenNewItem = () => {
    setEditingItem(null);
    setFormSku(`ITM-${Date.now().toString().slice(-4)}`);
    setFormName('');
    setFormItemType('FOOD_CARRYING_STOCK');
    setFormCategory('Sembako');
    setFormSubcategory('');
    setFormBaseUnit('Kg');
    setFormMinStock(20);
    setFormReorderPoint(40);
    setFormLocation('Gudang Kering - Rak A');
    setFormExpiryTracking(true);
    setFormIsActive(true);
    setFormNotes('');
    setFormError('');
    setIsNewItemModalOpen(true);
  };

  const handleOpenEditItem = (item: ItemMaster) => {
    setEditingItem(item);
    setFormSku(item.id);
    setFormName(item.name);
    setFormItemType(item.itemType);
    setFormCategory(item.category);
    setFormSubcategory(item.subcategory || '');
    setFormBaseUnit(item.baseUnit);
    setFormMinStock(item.minimumStock);
    setFormReorderPoint(item.reorderPoint);
    setFormLocation(item.location);
    setFormExpiryTracking(item.expiryTrackingEnabled);
    setFormIsActive(item.isActive);
    setFormNotes(item.notes || '');
    setFormError('');
    setIsNewItemModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    try {
      const isNew = !editingItem;
      const itemToSave: ItemMaster = {
        id: formSku.trim(),
        name: formName.trim(),
        itemType: formItemType,
        category: formCategory,
        subcategory: formSubcategory.trim() || undefined,
        baseUnit: formBaseUnit,
        minimumStock: Number(formMinStock),
        reorderPoint: Number(formReorderPoint),
        currentStock: editingItem ? editingItem.currentStock : 0,
        location: formLocation.trim(),
        expiryTrackingEnabled: formExpiryTracking,
        isActive: formIsActive,
        notes: formNotes.trim() || undefined,
        lastMovementDate: editingItem?.lastMovementDate,
      };

      warehouseDb.saveItem(itemToSave, currentUser, isNew);
      refreshData();
      setIsNewItemModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data item master.');
    }
  };

  const handleOpenConsume = (item: ItemMaster) => {
    setConsumingItem(item);
    setConsumeQty(1);
    setConsumeNotes('Pengeluaran untuk olahan menu dapur gizi siang');
    setConsumeLocation(item.location);
  };

  const handleExecuteConsumption = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consumingItem) return;

    try {
      warehouseDb.recordConsumption(
        consumingItem.id,
        consumeQty,
        consumeLocation,
        currentUser,
        consumeNotes
      );
      refreshData();
      setConsumingItem(null);
    } catch (err: any) {
      alert(err.message || 'Gagal mencatat pengeluaran bahan.');
    }
  };

  // Filter Items
  const filteredItems = items.filter(item => {
    // Exclude equipment from consumables inventory screen
    if (item.itemType === 'EQUIPMENT') return false;

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      item.id.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q);

    const matchesType = filterType === 'ALL' || item.itemType === filterType;
    const matchesCategory = filterCategory === 'ALL' || item.category === filterCategory;

    const status = getItemStockStatus(item);
    const matchesStatus = filterStatus === 'ALL' || status === filterStatus;

    return matchesSearch && matchesType && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Master Barang & Posisi Stok</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor saldo stok real-time, status minimum stok, lokasi simpan, dan pengeluaran bahan ke dapur.
          </p>
        </div>

        {can('MANAGE_ITEMS') && (
          <button
            onClick={handleOpenNewItem}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Master Item
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari SKU, nama barang, kategori, atau lokasi rak..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Tipe:</span>
            </div>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Tipe</option>
              <option value="FOOD_CARRYING_STOCK">Food: Carrying Stock (Sembako)</option>
              <option value="FOOD_DAILY_FLOW">Food: Daily Flow (Protein/Sayur/Buah)</option>
              <option value="OPERATIONAL_CONSUMABLE">Operasional Non-Food</option>
            </select>

            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="Sembako">Sembako</option>
              <option value="Protein">Protein</option>
              <option value="Sayuran">Sayuran</option>
              <option value="Buah">Buah</option>
              <option value="Cleaning">Cleaning</option>
              <option value="Packaging">Packaging</option>
              <option value="Hygiene/PPE">Hygiene/PPE</option>
              <option value="General Operational">General Operational</option>
            </select>

            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Status Stok</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low Stock (Di Bawah Min)</option>
              <option value="OUT_OF_STOCK">Habis (0 Stock)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-4">Tipe Aliran</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4 text-right">Stok Saat Ini</th>
                <th className="py-3 px-4 text-right">Min Stock</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Lokasi Simpan</th>
                <th className="py-3 px-4">Mutasi Terakhir</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                    Tidak ada item yang sesuai dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const status = getItemStockStatus(item);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{item.id}</div>
                      </td>
                      <td className="py-3 px-4">
                        {item.itemType === 'FOOD_DAILY_FLOW' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                            Daily Flow (Harian)
                          </span>
                        ) : item.itemType === 'FOOD_CARRYING_STOCK' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Carrying Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            Operasional
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        <div>{item.category}</div>
                        {item.subcategory && (
                          <div className="text-[10px] text-slate-400">{item.subcategory}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {item.currentStock.toLocaleString('id-ID')}
                        </span>{' '}
                        <span className="text-slate-500 font-medium">{item.baseUnit}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        {item.minimumStock} {item.baseUnit}
                      </td>
                      <td className="py-3 px-4">
                        {status === 'NORMAL' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Normal
                          </span>
                        )}
                        {status === 'LOW' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <AlertTriangle className="w-3 h-3" /> Low Stock
                          </span>
                        )}
                        {status === 'OUT_OF_STOCK' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            <XCircle className="w-3 h-3" /> Habis
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">{item.location}</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">
                        {item.lastMovementDate || '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {can('RECORD_CONSUMPTION') && (
                            <button
                              onClick={() => handleOpenConsume(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 transition-colors cursor-pointer"
                              title="Keluarkan bahan untuk kebutuhan dapur"
                            >
                              <ArrowDownRight className="w-3 h-3" />
                              Keluar Dapur
                            </button>
                          )}
                          {can('MANAGE_ITEMS') && (
                            <button
                              onClick={() => handleOpenEditItem(item)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                              title="Edit Master Data"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK CONSUMPTION MODAL */}
      {consumingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-amber-600" />
                Catat Pengeluaran Bahan ke Dapur
              </h3>
              <button
                onClick={() => setConsumingItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteConsumption} className="mt-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="font-bold text-slate-800 text-sm">{consumingItem.name}</div>
                <div className="text-slate-500 mt-0.5 flex justify-between">
                  <span>SKU: {consumingItem.id}</span>
                  <span className="font-semibold text-emerald-700">
                    Sisa Stok: {consumingItem.currentStock} {consumingItem.baseUnit}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Jumlah Pengeluaran ({consumingItem.baseUnit}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.1"
                  max={consumingItem.currentStock > 0 ? consumingItem.currentStock : 9999}
                  step="any"
                  value={consumeQty}
                  onChange={e => setConsumeQty(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs font-mono font-bold rounded-lg border border-slate-300 p-2 text-slate-900 focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tujuan Lokasi / Stasiun</label>
                <input
                  type="text"
                  value={consumeLocation}
                  onChange={e => setConsumeLocation(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan / Keperluan Masak</label>
                <textarea
                  rows={2}
                  value={consumeNotes}
                  onChange={e => setConsumeNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-800"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConsumingItem(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs"
                >
                  Posting Pengeluaran Bahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT ITEM MODAL */}
      {isNewItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                {editingItem ? 'Edit Master Item' : 'Tambah Master Item Baru'}
              </h3>
              <button
                onClick={() => setIsNewItemModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveItem} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    SKU / Kode Item <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formSku}
                    disabled={!!editingItem}
                    onChange={e => setFormSku(e.target.value)}
                    className="w-full text-xs font-mono font-semibold rounded border border-slate-300 p-2 text-slate-900 disabled:bg-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tipe Item <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formItemType}
                    onChange={e => setFormItemType(e.target.value as ItemType)}
                    className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800"
                  >
                    <option value="FOOD_CARRYING_STOCK">Food: Carrying Stock (Sembako)</option>
                    <option value="FOOD_DAILY_FLOW">Food: Daily Flow (Protein/Sayur/Buah)</option>
                    <option value="OPERATIONAL_CONSUMABLE">Operasional Non-Food</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Barang Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Beras Pandan Wangi Premium 25kg"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full text-xs rounded border border-slate-300 p-2 text-slate-900 font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as ItemCategory)}
                    className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800"
                  >
                    <option value="Sembako">Sembako</option>
                    <option value="Protein">Protein</option>
                    <option value="Sayuran">Sayuran</option>
                    <option value="Buah">Buah</option>
                    <option value="Cleaning">Cleaning</option>
                    <option value="Packaging">Packaging</option>
                    <option value="Hygiene/PPE">Hygiene/PPE</option>
                    <option value="General Operational">General Operational</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subkategori</label>
                  <input
                    type="text"
                    placeholder="Contoh: Unggas Segar"
                    value={formSubcategory}
                    onChange={e => setFormSubcategory(e.target.value)}
                    className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Satuan Dasar</label>
                  <select
                    value={formBaseUnit}
                    onChange={e => setFormBaseUnit(e.target.value as BaseUnit)}
                    className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800"
                  >
                    <option value="Kg">Kg</option>
                    <option value="Liter">Liter</option>
                    <option value="Gram">Gram</option>
                    <option value="Pack">Pack</option>
                    <option value="Pcs">Pcs</option>
                    <option value="Dus">Dus</option>
                    <option value="Roll">Roll</option>
                    <option value="Botol">Botol</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Min. Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={formMinStock}
                    onChange={e => setFormMinStock(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs font-mono rounded border border-slate-300 p-2 text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reorder Point</label>
                  <input
                    type="number"
                    min="0"
                    value={formReorderPoint}
                    onChange={e => setFormReorderPoint(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs font-mono rounded border border-slate-300 p-2 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lokasi Simpan Standar</label>
                <input
                  type="text"
                  placeholder="Contoh: Gudang Kering - Rak A2"
                  value={formLocation}
                  onChange={e => setFormLocation(e.target.value)}
                  className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800"
                  required
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formExpiryTracking}
                    onChange={e => setFormExpiryTracking(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-700">Lacak Tanggal Kadaluarsa (Expiry)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={e => setFormIsActive(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-700">Status Aktif</span>
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan</label>
                <input
                  type="text"
                  placeholder="Spesifikasi nutrisi / sertifikasi halal / SNI..."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewItemModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
                >
                  Simpan Master Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
