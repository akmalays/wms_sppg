import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import {
  ItemMaster,
  ReceivingDocument,
  ReceivingLine,
  Supplier,
  NonFoodExpense,
  normalizeItemCategory,
  MainItemCategory
} from '../types/warehouse';
import {
  Plus,
  Trash2,
  CheckCircle,
  Search,
  FileText,
  AlertCircle,
  Eye,
  ArrowLeft,
  PackagePlus,
  TableProperties,
  ClipboardPaste,
  PlusCircle,
  ShoppingBag,
  Store,
  Calendar,
  Clock,
  DollarSign,
  Tag,
  Filter,
  CheckCircle2,
  ChevronRight,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { SignaturePad } from './SignaturePad';
import { ReceivingDetailModal } from './ReceivingDetailModal';
import { PhotoUploadCompressor } from './PhotoUploadCompressor';
import { SppgLogo } from './SppgLogo';
import { exportToExcel } from '../lib/excelExport';

interface ReceivingModuleProps {
  onRefreshData?: () => void;
}

// ----------------------------------------------------
// Master Catalog for Quick Autocomplete & Auto-Pricing
// ----------------------------------------------------
export const COMMON_GOODS_CATALOG = [
  // Barang Basah
  { name: 'Daging Ayam Broiler Karkas Bersih', category: 'Barang Basah', unit: 'Kg', price: 38000 },
  { name: 'Daging Sapi Segar Rendang', category: 'Barang Basah', unit: 'Kg', price: 120000 },
  { name: 'Telur Ayam Ras Segar', category: 'Barang Basah', unit: 'Kg', price: 28000 },
  { name: 'Ikan Kembung Segar', category: 'Barang Basah', unit: 'Kg', price: 35000 },
  { name: 'Ikan Lele Segar', category: 'Barang Basah', unit: 'Kg', price: 26000 },
  { name: 'Sayur Bayam Hijau Segar', category: 'Barang Basah', unit: 'Ikat', price: 3500 },
  { name: 'Sayur Kangkung Segar', category: 'Barang Basah', unit: 'Ikat', price: 3000 },
  { name: 'Wortel Segar Brastagi', category: 'Barang Basah', unit: 'Kg', price: 12000 },
  { name: 'Labu Siam Segar', category: 'Barang Basah', unit: 'Kg', price: 9000 },
  { name: 'Kacang Panjang Segar', category: 'Barang Basah', unit: 'Kg', price: 14000 },
  { name: 'Buncis Segar', category: 'Barang Basah', unit: 'Kg', price: 16000 },
  { name: 'Tahu Putih Segar', category: 'Barang Basah', unit: 'Pcs', price: 1000 },
  { name: 'Tempe Segar Kedelai', category: 'Barang Basah', unit: 'Pcs', price: 4000 },
  { name: 'Buah Pisang Cavendish / Ambon', category: 'Barang Basah', unit: 'Kg', price: 16000 },
  { name: 'Buah Semangka Merah Non Biji', category: 'Barang Basah', unit: 'Kg', price: 8500 },
  { name: 'Buah Pepaya California', category: 'Barang Basah', unit: 'Kg', price: 7500 },
  { name: 'Buah Melon Segar', category: 'Barang Basah', unit: 'Kg', price: 14000 },

  // Barang Kering
  { name: 'Beras Ramos Premium SPPG', category: 'Barang Kering', unit: 'Kg', price: 14500 },
  { name: 'Minyak Goreng Sawit 2L', category: 'Barang Kering', unit: 'Pouch', price: 36000 },
  { name: 'Gula Pasir Kristal Putih', category: 'Barang Kering', unit: 'Kg', price: 17500 },
  { name: 'Tepung Terigu Segitiga Biru', category: 'Barang Kering', unit: 'Kg', price: 12000 },
  { name: 'Tepung Tapioka / Kanji', category: 'Barang Kering', unit: 'Kg', price: 11000 },
  { name: 'Garam Dapur Beryodium', category: 'Barang Kering', unit: 'Bungkus', price: 4000 },
  { name: 'Kecap Manis Bango 520ml', category: 'Barang Kering', unit: 'Pouch', price: 24000 },
  { name: 'Saus Tomat / Sambal 1kg', category: 'Barang Kering', unit: 'Pouch', price: 18000 },
  { name: 'Bawang Merah Brebes', category: 'Barang Kering', unit: 'Kg', price: 38000 },
  { name: 'Bawang Putih Kating', category: 'Barang Kering', unit: 'Kg', price: 36000 },
  { name: 'Bumbu Racik Gule / Opor', category: 'Barang Kering', unit: 'Sachet', price: 3000 },
  { name: 'Merica Bubuk Ladaku', category: 'Barang Kering', unit: 'Sachet', price: 1500 },

  // ATK & Administrasi
  { name: 'Kertas HVS A4 70/80gr (PaperOne)', category: 'ATK & Administrasi', unit: 'Rim', price: 48000 },
  { name: 'Kertas HVS F4 70gr', category: 'ATK & Administrasi', unit: 'Rim', price: 54000 },
  { name: 'Buku Catatan Ekspedisi SPPG', category: 'ATK & Administrasi', unit: 'Buku', price: 18000 },
  { name: 'Pulpen Gel Hitam / Biru', category: 'ATK & Administrasi', unit: 'Pack', price: 25000 },
  { name: 'Spidol Boardmarker Whiteboard', category: 'ATK & Administrasi', unit: 'Pcs', price: 9000 },
  { name: 'Map Ordner Bantex F4', category: 'ATK & Administrasi', unit: 'Pcs', price: 26000 },
  { name: 'Map Snelhecter Plastik', category: 'ATK & Administrasi', unit: 'Lusin', price: 24000 },
  { name: 'Tinta Printer Epson Original', category: 'ATK & Administrasi', unit: 'Botol', price: 85000 },
  { name: 'Isi Staples No. 10 Max', category: 'ATK & Administrasi', unit: 'Kotak', price: 4000 },
  { name: 'Lakban Bening / Coklat 2 Inch', category: 'ATK & Administrasi', unit: 'Roll', price: 14000 },

  // Alat Kebersihan & Sanitasi
  { name: 'Sabun Cuci Piring Sunlight Jeruk Nipis 750ml', category: 'Alat Kebersihan', unit: 'Pouch', price: 18500 },
  { name: 'Karbol Wangi Pembersih Lantai Wipol 750ml', category: 'Alat Kebersihan', unit: 'Pouch', price: 16000 },
  { name: 'Sabun Cuci Tangan Handsoap 4L Jerigen', category: 'Alat Kebersihan', unit: 'Jerigen', price: 55000 },
  { name: 'Spons Busa Cuci Piring Scotch-Brite', category: 'Alat Kebersihan', unit: 'Pack', price: 14000 },
  { name: 'Kain Lap Microfiber Halus', category: 'Alat Kebersihan', unit: 'Pcs', price: 8000 },
  { name: 'Kain Lap Kanebo Serap Air', category: 'Alat Kebersihan', unit: 'Pcs', price: 15000 },
  { name: 'Plastik Sampah Hitam Trash Bag 80x100', category: 'Alat Kebersihan', unit: 'Pack', price: 28000 },
  { name: 'Sapu Lantai Nilon & Pengki Cikrak', category: 'Alat Kebersihan', unit: 'Set', price: 35000 },
  { name: 'Alat Pel Lantai Putar Mop', category: 'Alat Kebersihan', unit: 'Set', price: 85000 },
  { name: 'Kapur Barus Kamper Toilet', category: 'Alat Kebersihan', unit: 'Pack', price: 16000 },

  // Perlengkapan Dapur & APD
  { name: 'Plastik Kresek Putih Bening 24/28', category: 'Perlengkapan & APD', unit: 'Pack', price: 15000 },
  { name: 'Kotak Makan Mika Bento / Thinwall 650ml', category: 'Perlengkapan & APD', unit: 'Dus', price: 135000 },
  { name: 'Sarung Tangan Plastik Higienis Disposable', category: 'Perlengkapan & APD', unit: 'Kotak', price: 14000 },
  { name: 'Masker Medis 3-Ply Earloop', category: 'Perlengkapan & APD', unit: 'Kotak', price: 25000 },
  { name: 'Nurse Cap Tutup Kepala Dapur SPPG', category: 'Perlengkapan & APD', unit: 'Kotak', price: 32000 },
  { name: 'Celemek / Apron Masak Waterproof', category: 'Perlengkapan & APD', unit: 'Pcs', price: 22000 },
  { name: 'Pisau Dapur Stainless Steel Tramontina', category: 'Perlengkapan & APD', unit: 'Pcs', price: 45000 },

  // Operasional & Keperluan Lain
  { name: 'Refill Tabung Gas Elpiji 12 Kg', category: 'Operasional & Keperluan Lain', unit: 'Tabung', price: 215000 },
  { name: 'Refill Tabung Gas Elpiji 3 Kg', category: 'Operasional & Keperluan Lain', unit: 'Tabung', price: 21000 },
  { name: 'Air Minum Galon Aqua / Le Minerale 19L', category: 'Operasional & Keperluan Lain', unit: 'Galon', price: 20000 },
  { name: 'Es Batu Kristal Higienis 10 Kg', category: 'Operasional & Keperluan Lain', unit: 'Karung', price: 15000 },
  { name: 'Token Listrik PLN Dapur Operasional', category: 'Operasional & Keperluan Lain', unit: 'Voucher', price: 200000 },
];

export const INPUT_CATEGORIES = [
  'Barang Basah',
  'Barang Kering',
  'ATK & Administrasi',
  'Alat Kebersihan',
  'Perlengkapan & APD',
  'Operasional & Keperluan Lain',
] as const;

export type InputCategoryType = typeof INPUT_CATEGORIES[number];

function autoDetectCategory(itemName: string): InputCategoryType {
  const n = itemName.toLowerCase();
  if (
    n.includes('ayam') ||
    n.includes('daging') ||
    n.includes('telur') ||
    n.includes('ikan') ||
    n.includes('sayur') ||
    n.includes('bayam') ||
    n.includes('kangkung') ||
    n.includes('wortel') ||
    n.includes('tahu') ||
    n.includes('tempe') ||
    n.includes('buah') ||
    n.includes('pisang') ||
    n.includes('semangka') ||
    n.includes('pepaya') ||
    n.includes('melon') ||
    n.includes('buncis') ||
    n.includes('labu')
  ) {
    return 'Barang Basah';
  }
  if (
    n.includes('beras') ||
    n.includes('minyak') ||
    n.includes('gula') ||
    n.includes('tepung') ||
    n.includes('garam') ||
    n.includes('kecap') ||
    n.includes('saus') ||
    n.includes('bawang') ||
    n.includes('merica') ||
    n.includes('racik') ||
    n.includes('kering') ||
    n.includes('mie') ||
    n.includes('bihun')
  ) {
    return 'Barang Kering';
  }
  if (
    n.includes('hvs') ||
    n.includes('kertas') ||
    n.includes('pulpen') ||
    n.includes('spidol') ||
    n.includes('buku') ||
    n.includes('ordner') ||
    n.includes('map') ||
    n.includes('printer') ||
    n.includes('tinta') ||
    n.includes('staples') ||
    n.includes('lakban') ||
    n.includes('atk') ||
    n.includes('stempel')
  ) {
    return 'ATK & Administrasi';
  }
  if (
    n.includes('sunlight') ||
    n.includes('karbol') ||
    n.includes('wipol') ||
    n.includes('sabun') ||
    n.includes('spons') ||
    n.includes('lap') ||
    n.includes('kanebo') ||
    n.includes('trash') ||
    n.includes('sampah') ||
    n.includes('sapu') ||
    n.includes('pel') ||
    n.includes('mop') ||
    n.includes('bersih') ||
    n.includes('deterjen')
  ) {
    return 'Alat Kebersihan';
  }
  if (
    n.includes('sarung tangan') ||
    n.includes('masker') ||
    n.includes('nurse cap') ||
    n.includes('celemek') ||
    n.includes('apron') ||
    n.includes('mika') ||
    n.includes('thinwall') ||
    n.includes('kresek') ||
    n.includes('plastik') ||
    n.includes('pisau') ||
    n.includes('spatula') ||
    n.includes('apd')
  ) {
    return 'Perlengkapan & APD';
  }
  if (
    n.includes('gas') ||
    n.includes('elpiji') ||
    n.includes('galon') ||
    n.includes('es batu') ||
    n.includes('listrik') ||
    n.includes('token') ||
    n.includes('air') ||
    n.includes('operasional')
  ) {
    return 'Operasional & Keperluan Lain';
  }
  return 'Barang Kering';
}

function getItemCatalogInfo(name: string) {
  const match = COMMON_GOODS_CATALOG.find(
    c => c.name.toLowerCase() === name.toLowerCase().trim()
  );
  if (match) return match;
  // Partial match
  const partial = COMMON_GOODS_CATALOG.find(c =>
    name.toLowerCase().includes(c.name.toLowerCase().slice(0, 8))
  );
  return partial || null;
}

interface BatchInputRow {
  id: string;
  itemName: string;
  category: InputCategoryType;
  qty: string;
  unit: string;
  unitPrice: number;
  time: string;
  supplier: string;
  volunteer: string;
  notes: string;
}

export const ReceivingModule: React.FC<ReceivingModuleProps> = ({ onRefreshData }) => {
  const { currentUser, can } = useAuth();

  // Data states
  const [dataVersion, setDataVersion] = useState(0);
  const receivings = useMemo(() => warehouseDb.getReceivings(), [dataVersion]);
  const expenses = useMemo(() => warehouseDb.getNonFoodExpenses(), [dataVersion]);
  const items = useMemo(
    () => warehouseDb.getItems().filter(i => i.isActive && i.itemType !== 'EQUIPMENT'),
    [dataVersion]
  );
  const suppliers = useMemo(
    () => warehouseDb.getSuppliers().filter(s => s.isActive),
    [dataVersion]
  );

  // Active views & modals
  const [isCreatingDeliveryOrder, setIsCreatingDeliveryOrder] = useState(false);
  const [isSingleInputModalOpen, setIsSingleInputModalOpen] = useState(false);
  const [isBatchInputModalOpen, setIsBatchInputModalOpen] = useState(false);
  const [selectedDocForDetail, setSelectedDocForDetail] = useState<ReceivingDocument | null>(null);

  // Filters & Tabs
  const [activeCategoryTab, setActiveCategoryTab] = useState<'ALL' | InputCategoryType | 'SURAT_JALAN'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const defaultCurrentTime = new Date()
    .toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    .replace(':', '.');

  // ----------------------------------------------------
  // Single Input Form State
  // ----------------------------------------------------
  const [singleDate, setSingleDate] = useState(today);
  const [singleTime, setSingleTime] = useState(defaultCurrentTime);
  const [singleCategory, setSingleCategory] = useState<InputCategoryType>('Barang Basah');
  const [singleItemName, setSingleItemName] = useState('');
  const [singleQty, setSingleQty] = useState('1');
  const [singleUnit, setSingleUnit] = useState('Kg');
  const [singleUnitPrice, setSingleUnitPrice] = useState<number>(0);
  const [singleSupplier, setSingleSupplier] = useState('');
  const [singlePic, setSinglePic] = useState(currentUser.name);
  const [singleVolunteer, setSingleVolunteer] = useState('');
  const [singleNotes, setSingleNotes] = useState('');
  const [singleReceiptRef, setSingleReceiptRef] = useState('');

  // ----------------------------------------------------
  // Batch Input Form State
  // ----------------------------------------------------
  const [batchDate, setBatchDate] = useState(today);
  const [batchPic, setBatchPic] = useState(currentUser.name);
  const [batchInputMode, setBatchInputMode] = useState<'GRID' | 'PASTE'>('GRID');
  const [batchRawPaste, setBatchRawPaste] = useState('');
  const [batchRows, setBatchRows] = useState<BatchInputRow[]>([
    { id: '1', itemName: '', category: 'Barang Basah', qty: '1', unit: 'Kg', unitPrice: 0, time: defaultCurrentTime, supplier: '', volunteer: '', notes: '' },
    { id: '2', itemName: '', category: 'Barang Basah', qty: '1', unit: 'Kg', unitPrice: 0, time: defaultCurrentTime, supplier: '', volunteer: '', notes: '' },
    { id: '3', itemName: '', category: 'Barang Kering', qty: '1', unit: 'Kg', unitPrice: 0, time: defaultCurrentTime, supplier: '', volunteer: '', notes: '' },
    { id: '4', itemName: '', category: 'ATK & Administrasi', qty: '1', unit: 'Pack', unitPrice: 0, time: defaultCurrentTime, supplier: '', volunteer: '', notes: '' },
    { id: '5', itemName: '', category: 'Alat Kebersihan', qty: '1', unit: 'Pouch', unitPrice: 0, time: defaultCurrentTime, supplier: '', volunteer: '', notes: '' },
  ]);

  // ----------------------------------------------------
  // Delivery Order / Surat Jalan Form State
  // ----------------------------------------------------
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formDate, setFormDate] = useState(today);
  const [formTime, setFormTime] = useState(new Date().toTimeString().slice(0, 5));
  const [formDeliveryNote, setFormDeliveryNote] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formSupplierSign, setFormSupplierSign] = useState('');
  const [formReceiverSign, setFormReceiverSign] = useState('');
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [lines, setLines] = useState<Omit<ReceivingLine, 'id'>[]>([
    {
      itemId: items[0]?.id || '',
      itemName: items[0]?.name || '',
      category: items[0]?.category || 'Sembako',
      quantity: 1,
      unit: items[0]?.baseUnit || 'Kg',
      conditionNote: 'Kondisi kemasan baik & bersih',
      batchNumber: '',
    },
  ]);

  const refreshAll = () => {
    setDataVersion(v => v + 1);
    if (onRefreshData) onRefreshData();
  };

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4500);
  };

  // ----------------------------------------------------
  // Handlers for Single Input
  // ----------------------------------------------------
  const handleOpenSingleModal = () => {
    setSingleDate(new Date().toISOString().slice(0, 10));
    setSingleTime(
      new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.')
    );
    setSingleCategory('Barang Basah');
    setSingleItemName('');
    setSingleQty('1');
    setSingleUnit('Kg');
    setSingleUnitPrice(0);
    setSingleSupplier('');
    setSinglePic(currentUser.name);
    setSingleVolunteer('');
    setSingleNotes('');
    setSingleReceiptRef('');
    setIsSingleInputModalOpen(true);
  };

  const handleSingleItemChange = (val: string) => {
    setSingleItemName(val);
    const cat = autoDetectCategory(val);
    setSingleCategory(cat);

    const catalog = getItemCatalogInfo(val);
    if (catalog) {
      setSingleUnit(catalog.unit);
      setSingleUnitPrice(catalog.price);
    }
  };

  const handleSaveSingleItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleItemName.trim()) {
      alert('Nama barang wajib diisi.');
      return;
    }

    const numQty = parseFloat(singleQty) || 1;
    const finalPrice = singleUnitPrice > 0 ? singleUnitPrice : (getItemCatalogInfo(singleItemName)?.price || 0);
    const totalCost = numQty * finalPrice;

    warehouseDb.recordNonFoodExpense(
      {
        date: singleDate,
        time: singleTime.trim() || defaultCurrentTime,
        itemName: singleItemName.trim(),
        category: singleCategory,
        quantity: singleQty.trim() || '1',
        unit: singleUnit.trim() || 'Pcs',
        unitPrice: finalPrice,
        totalCost: totalCost,
        pic: singlePic.trim() || currentUser.name,
        volunteer: singleVolunteer.trim() || undefined,
        department: singleCategory.includes('ATK')
          ? 'Administrasi & Kantor'
          : singleCategory.includes('Kebersihan')
          ? 'Area Cuci & Sanitasi'
          : 'Dapur Pengolahan Utama',
        notes: `${singleSupplier ? `[Toko/Supplier: ${singleSupplier}] ` : ''}${singleNotes.trim()}`.trim() || undefined,
        receiptRef: singleReceiptRef.trim() || undefined,
      },
      currentUser
    );

    showToast(`Berhasil mencatat input barang: "${singleItemName.trim()}" (${singleQty} ${singleUnit})!`);
    setIsSingleInputModalOpen(false);
    refreshAll();
  };

  // ----------------------------------------------------
  // Handlers for Batch Input
  // ----------------------------------------------------
  const handleOpenBatchModal = () => {
    setBatchDate(new Date().toISOString().slice(0, 10));
    setBatchPic(currentUser.name);
    setBatchInputMode('GRID');
    setBatchRawPaste('');
    setIsBatchInputModalOpen(true);
  };

  const handleAddBatchRows = (count: number = 1) => {
    const newRows: BatchInputRow[] = [];
    for (let i = 0; i < count; i++) {
      newRows.push({
        id: String(Date.now() + Math.random()),
        itemName: '',
        category: 'Barang Basah',
        qty: '1',
        unit: 'Kg',
        unitPrice: 0,
        time: defaultCurrentTime,
        supplier: '',
        volunteer: '',
        notes: '',
      });
    }
    setBatchRows(prev => [...prev, ...newRows]);
  };

  const handleUpdateBatchRow = (id: string, field: keyof BatchInputRow, value: any) => {
    setBatchRows(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === 'itemName') {
          updated.category = autoDetectCategory(value);
          const cat = getItemCatalogInfo(value);
          if (cat) {
            updated.unit = cat.unit;
            updated.unitPrice = cat.price;
          }
        }
        return updated;
      })
    );
  };

  const handleRemoveBatchRow = (id: string) => {
    setBatchRows(prev => (prev.length > 1 ? prev.filter(r => r.id !== id) : prev));
  };

  const handleParsePastedExcel = () => {
    if (!batchRawPaste.trim()) {
      alert('Tempelkan teks data dari Excel / Google Sheet terlebih dahulu.');
      return;
    }

    const lines = batchRawPaste.trim().split(/\r?\n/);
    const parsedRows: BatchInputRow[] = [];

    lines.forEach((line, idx) => {
      let cols = line.split('\t');
      if (cols.length === 1 && line.includes(';')) cols = line.split(';');
      else if (cols.length === 1 && line.includes(',')) cols = line.split(',');

      const c0 = (cols[0] || '').trim();
      const c1 = (cols[1] || '').trim();
      const c2 = (cols[2] || '').trim();
      const c3 = (cols[3] || '').trim();
      const c4 = (cols[4] || '').trim();
      const c5 = (cols[5] || '').trim();

      if (idx === 0 && (c0.toLowerCase().includes('nama') || c0.toLowerCase().includes('tanggal') || c0.toLowerCase().includes('barang'))) {
        return;
      }

      let itemName = c0;
      let qty = '1';
      let unit = 'Pcs';
      let price = 0;
      let supplier = '';
      let notes = '';

      if (cols.length >= 4) {
        itemName = c0;
        qty = c1 || '1';
        unit = c2 || 'Pcs';
        price = parseFloat(c3.replace(/[^\d.-]/g, '')) || 0;
        supplier = c4 || '';
        notes = c5 || '';
      } else if (cols.length >= 2) {
        itemName = c0;
        qty = c1 || '1';
      }

      if (itemName) {
        const cat = autoDetectCategory(itemName);
        const catalog = getItemCatalogInfo(itemName);
        if (catalog && price === 0) price = catalog.price;
        if (catalog && (!c2 || unit === 'Pcs')) unit = catalog.unit;

        parsedRows.push({
          id: String(Date.now() + Math.random() + idx),
          itemName,
          category: cat,
          qty,
          unit,
          unitPrice: price,
          time: defaultCurrentTime,
          supplier,
          volunteer: '',
          notes,
        });
      }
    });

    if (parsedRows.length > 0) {
      setBatchRows(parsedRows);
      setBatchInputMode('GRID');
      setBatchRawPaste('');
      alert(`Berhasil mengekstrak ${parsedRows.length} baris barang dari Excel! Periksa dan simpan.`);
    } else {
      alert('Tidak ada baris barang yang terdeteksi dari teks yang ditempel.');
    }
  };

  const handleSaveBatchRows = (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = batchRows.filter(r => r.itemName.trim() !== '');
    if (validRows.length === 0) {
      alert('Isi minimal 1 nama barang pada tabel sebelum menyimpan.');
      return;
    }

    const payload = validRows.map(r => {
      const numQty = parseFloat(r.qty) || 1;
      const price = r.unitPrice > 0 ? r.unitPrice : (getItemCatalogInfo(r.itemName)?.price || 0);
      return {
        date: batchDate,
        time: r.time.trim() || defaultCurrentTime,
        itemName: r.itemName.trim(),
        category: r.category,
        quantity: r.qty.trim() || '1',
        unit: r.unit.trim() || 'Pcs',
        unitPrice: price,
        totalCost: numQty * price,
        pic: batchPic.trim() || currentUser.name,
        volunteer: r.volunteer.trim() || undefined,
        department: r.category.includes('ATK')
          ? 'Administrasi & Kantor'
          : r.category.includes('Kebersihan')
          ? 'Area Cuci & Sanitasi'
          : 'Dapur Pengolahan Utama',
        notes: `${r.supplier ? `[Toko: ${r.supplier}] ` : ''}${r.notes.trim()}`.trim() || undefined,
      };
    });

    warehouseDb.recordNonFoodExpensesBatch(payload, currentUser);
    showToast(`Berhasil menyimpan ${validRows.length} barang belanja & pengeluaran sekaligus!`);
    setIsBatchInputModalOpen(false);
    refreshAll();
  };

  // ----------------------------------------------------
  // Handlers for Delivery Order (Penerimaan Supplier Resmi)
  // ----------------------------------------------------
  const handleOpenDeliveryOrder = () => {
    setFormSupplierId(suppliers[0]?.id || '');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormTime(new Date().toTimeString().slice(0, 5));
    setFormDeliveryNote('');
    setFormNotes('');
    setFormSupplierSign('');
    setFormReceiverSign(`VERIFIED: ${currentUser.name}`);
    setFormPhotos([]);
    setErrorMessage('');

    if (items.length > 0) {
      setLines([
        {
          itemId: items[0].id,
          itemName: items[0].name,
          category: items[0].category,
          quantity: 1,
          unit: items[0].baseUnit,
          conditionNote: 'Kondisi kemasan baik & bersih',
          batchNumber: '',
        },
      ]);
    }
    setIsCreatingDeliveryOrder(true);
  };

  const handleLineItemChange = (index: number, itemId: string) => {
    const selectedItem = items.find(i => i.id === itemId);
    if (!selectedItem) return;

    setLines(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        category: selectedItem.category,
        unit: selectedItem.baseUnit,
      };
      return updated;
    });
  };

  const handleLineQtyChange = (index: number, val: string) => {
    const num = parseFloat(val) || 0;
    setLines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: num };
      return updated;
    });
  };

  const handleLineNoteChange = (index: number, val: string) => {
    setLines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], conditionNote: val };
      return updated;
    });
  };

  const addLine = () => {
    const defaultItem = items[0];
    if (!defaultItem) return;
    setLines(prev => [
      ...prev,
      {
        itemId: defaultItem.id,
        itemName: defaultItem.name,
        category: defaultItem.category,
        quantity: 1,
        unit: defaultItem.baseUnit,
        conditionNote: '',
        batchNumber: '',
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) {
      setErrorMessage('Penerimaan harus memiliki minimal 1 baris item.');
      return;
    }
    setLines(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmitDeliveryOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formSupplierId) {
      setErrorMessage('Pilih supplier terlebih dahulu.');
      return;
    }

    const selectedSupplier = suppliers.find(s => s.id === formSupplierId);
    if (!selectedSupplier) {
      setErrorMessage('Supplier tidak valid.');
      return;
    }

    for (const [idx, line] of lines.entries()) {
      if (line.quantity <= 0) {
        setErrorMessage(`Baris #${idx + 1} (${line.itemName}): Kuantitas harus lebih dari 0.`);
        return;
      }
    }

    try {
      const newDoc = warehouseDb.postReceiving(
        {
          date: formDate,
          arrivalTime: formTime,
          supplierId: selectedSupplier.id,
          supplierName: selectedSupplier.name,
          deliveryNoteNo: formDeliveryNote || undefined,
          receiverId: currentUser.id,
          receiverName: currentUser.name,
          receiverRole: currentUser.role,
          notes: formNotes || undefined,
          lines: lines as any,
          supplierSignature: formSupplierSign || `TERVERIFIKASI: Staf Pengirim ${selectedSupplier.name}`,
          receiverSignature: formReceiverSign || `TERVERIFIKASI: ${currentUser.name} (${currentUser.role})`,
          documentationPhotos: formPhotos.length > 0 ? formPhotos : undefined,
        },
        currentUser
      );

      showToast(`Penerimaan barang #${newDoc.id} berhasil diposting ke stok gudang!`);
      setIsCreatingDeliveryOrder(false);
      setSelectedDocForDetail(newDoc);
      refreshAll();
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat memposting penerimaan.');
    }
  };

  const handleDeleteExpense = (id: string, name: string) => {
    if (window.confirm(`Hapus catatan input barang "${name}"?`)) {
      warehouseDb.deleteNonFoodExpense(id, currentUser);
      showToast(`Catatan "${name}" berhasil dihapus.`);
      refreshAll();
    }
  };

  // ----------------------------------------------------
  // Summary Metrics & Unified Table Data
  // ----------------------------------------------------
  const unifiedRecords = useMemo(() => {
    const list: Array<{
      id: string;
      source: 'EXPENSE_INPUT' | 'DELIVERY_ORDER';
      date: string;
      time: string;
      category: string;
      displayCategory: InputCategoryType | string;
      itemName: string;
      quantity: string | number;
      unit: string;
      unitPrice: number;
      nominal: number;
      supplierOrStore: string;
      picOrUser: string;
      volunteer?: string;
      notes?: string;
      rawDoc?: ReceivingDocument;
    }> = [];

    // Add manual / batch inputs
    expenses.forEach(exp => {
      const cat = exp.category;
      const numQty = typeof exp.quantity === 'number' ? exp.quantity : parseFloat(String(exp.quantity)) || 1;
      const price = exp.unitPrice || (getItemCatalogInfo(exp.itemName)?.price || 0);
      const total = exp.totalCost || numQty * price;

      list.push({
        id: exp.id,
        source: 'EXPENSE_INPUT',
        date: exp.date,
        time: exp.time || '12.00',
        category: cat,
        displayCategory: cat,
        itemName: exp.itemName,
        quantity: exp.quantity,
        unit: exp.unit || 'Pcs',
        unitPrice: price,
        nominal: total,
        supplierOrStore: exp.notes && exp.notes.includes('[Toko') ? (exp.notes.match(/\[(?:Toko|Supplier):\s*([^\]]+)\]/)?.[1] || '-') : '-',
        picOrUser: exp.pic || exp.recordedBy || currentUser.name,
        volunteer: exp.volunteer,
        notes: exp.notes,
      });
    });

    // Add Delivery Orders
    receivings.forEach(rec => {
      rec.lines.forEach((l, idx) => {
        const cat = autoDetectCategory(l.itemName);
        const price = getItemCatalogInfo(l.itemName)?.price || 0;
        const total = l.quantity * price;

        list.push({
          id: `${rec.id}-${idx}`,
          source: 'DELIVERY_ORDER',
          date: rec.date,
          time: rec.arrivalTime,
          category: 'Surat Jalan Supplier',
          displayCategory: cat,
          itemName: l.itemName,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: price,
          nominal: total,
          supplierOrStore: rec.supplierName,
          picOrUser: rec.receiverName,
          volunteer: undefined,
          notes: rec.deliveryNoteNo ? `SJ: ${rec.deliveryNoteNo}` : rec.notes,
          rawDoc: rec,
        });
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, receivings, currentUser.name]);

  // Metrics
  const metrics = useMemo(() => {
    let totalItems = 0;
    let totalCost = 0;
    let wetCost = 0;
    let dryCost = 0;
    let opCost = 0;

    unifiedRecords.forEach(r => {
      totalItems += 1;
      totalCost += r.nominal;
      const normalized = normalizeItemCategory(r.displayCategory || r.category);
      if (normalized === 'Bahan Basah') wetCost += r.nominal;
      else if (normalized === 'Bahan Kering') dryCost += r.nominal;
      else opCost += r.nominal;
    });

    return { totalItems, totalCost, wetCost, dryCost, opCost };
  }, [unifiedRecords]);

  // Filtered List
  const filteredRecords = useMemo(() => {
    return unifiedRecords.filter(r => {
      // Category filter
      if (activeCategoryTab === 'SURAT_JALAN') {
        if (r.source !== 'DELIVERY_ORDER') return false;
      } else if (activeCategoryTab !== 'ALL') {
        const catStr = (r.displayCategory || r.category || '').toLowerCase();
        const target = activeCategoryTab.toLowerCase();
        if (!catStr.includes(target) && !target.includes(catStr)) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.itemName.toLowerCase().includes(q);
        const matchSupplier = r.supplierOrStore.toLowerCase().includes(q);
        const matchPic = r.picOrUser.toLowerCase().includes(q);
        const matchNotes = (r.notes || '').toLowerCase().includes(q);
        const matchCategory = (r.category || '').toLowerCase().includes(q);
        if (!matchName && !matchSupplier && !matchPic && !matchNotes && !matchCategory) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedRecords, activeCategoryTab, searchQuery]);

  const selectedSupplierObj = suppliers.find(s => s.id === formSupplierId);

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      alert('Tidak ada data belanja / barang masuk untuk diekspor.');
      return;
    }

    const rows = filteredRecords.map((r, i) => ({
      No: i + 1,
      Tanggal: r.date,
      Jam: r.time,
      Kategori: r.displayCategory,
      'Nama Barang': r.itemName,
      Jumlah: r.quantity,
      Satuan: r.unit,
      'Estimasi Harga Satuan (Rp)': r.unitPrice,
      'Total Nominal (Rp)': r.nominal,
      'Toko / Supplier': r.supplierOrStore,
      'PIC Penerima': r.picOrUser,
      'Relawan / Petugas': r.volunteer || '-',
      Keterangan: r.notes || '-',
    }));

    exportToExcel(
      rows,
      `Rekap_Input_Barang_SPPG_Jeru_Tumpang_${today}.xlsx`,
      'Input Barang & Belanja'
    );
  };

  return (
    <div className="space-y-5">
      {/* Detail Modal for Delivery Orders */}
      <ReceivingDetailModal
        document={selectedDocForDetail}
        onClose={() => setSelectedDocForDetail(null)}
      />

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-medium animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HEADER BAR */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <SppgLogo size="md" variant="color" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Input Barang & Belanja Operasional
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pusat pencatatan barang datang, belanja bahan basah, bahan kering, serta pengeluaran operasional (ATK, alat kebersihan, APD, & keperluan lain).
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {!isCreatingDeliveryOrder && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Input Satuan */}
            <button
              onClick={handleOpenSingleModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer"
              title="Catat belanja atau penerimaan 1 jenis barang"
            >
              <Plus className="w-4 h-4" />
              <span>+ Input Satuan</span>
            </button>

            {/* Input Masal */}
            <button
              onClick={handleOpenBatchModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white shadow-2xs transition-colors cursor-pointer"
              title="Input banyak barang sekaligus lewat tabel atau tempel dari Excel"
            >
              <TableProperties className="w-4 h-4" />
              <span>Input Masal (Banyak Barang)</span>
            </button>

            {/* Delivery Order Supplier */}
            {can('RECEIVE_GOODS') && (
              <button
                onClick={handleOpenDeliveryOrder}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                title="Penerimaan resmi dari supplier dengan surat jalan dan tanda tangan digital"
              >
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                <span>Penerimaan Supplier (Surat Jalan)</span>
              </button>
            )}

            {/* Ekspor Excel */}
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Unduh rekap barang & belanja ke Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ekspor Excel</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SUMMARY KPI CARDS */}
      {/* ========================================================================= */}
      {!isCreatingDeliveryOrder && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Transaksi & Belanja */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold">Total Input & Belanja</span>
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-slate-900">
              Rp {metrics.totalCost.toLocaleString('id-ID')}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {metrics.totalItems} transaksi / catatan barang
            </p>
          </div>

          {/* Card 2: Bahan Basah */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold">Bahan Basah</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Dapur & Lauk
              </span>
            </div>
            <div className="text-xl font-bold text-emerald-700">
              Rp {metrics.wetCost.toLocaleString('id-ID')}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Ayam, daging, telur, ikan, sayuran & buah
            </p>
          </div>

          {/* Card 3: Bahan Kering */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold">Bahan Kering</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                Sembako & Bumbu
              </span>
            </div>
            <div className="text-xl font-bold text-amber-700">
              Rp {metrics.dryCost.toLocaleString('id-ID')}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Beras, minyak, gula, tepung & bumbu
            </p>
          </div>

          {/* Card 4: Pengeluaran Lain (ATK, Kebersihan, APD) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold">Operasional & Pengeluaran Lain</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                ATK & Sanitasi
              </span>
            </div>
            <div className="text-xl font-bold text-blue-700">
              Rp {metrics.opCost.toLocaleString('id-ID')}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              ATK, sabun, karbol, APD, gas & listrik
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FORM MODE: DELIVERY ORDER (SURAT JALAN SUPPLIER RESMI) */}
      {/* ========================================================================= */}
      {isCreatingDeliveryOrder ? (
        <form onSubmit={handleSubmitDeliveryOrder} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsCreatingDeliveryOrder(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Formulir Penerimaan Barang Supplier (Surat Jalan)</h3>
                <p className="text-[11px] text-slate-500">Pilih supplier yang datang, isi nomor surat jalan, lampirkan item barang & foto bukti fisik.</p>
              </div>
            </div>
            <span className="text-[11px] font-mono bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-semibold">
              Status: VERIFIED_POSTED
            </span>
          </div>

          {errorMessage && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-6 space-y-6">
            {/* Header Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              {/* Supplier Searchable Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier / Pemasok <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formSupplierId}
                  onChange={e => setFormSupplierId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  required
                >
                  <option value="">-- Pilih Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.contactPerson})
                    </option>
                  ))}
                </select>
                {selectedSupplierObj && (
                  <p className="text-[10px] text-slate-500 mt-1 truncate">{selectedSupplierObj.address}</p>
                )}
              </div>

              {/* Tanggal */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Masuk <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  required
                />
              </div>

              {/* Waktu Tiba */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Waktu Kedatangan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={formTime}
                  onChange={e => setFormTime(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  required
                />
              </div>

              {/* Penerima (PIC) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Penerima (PIC Gudang)</label>
                <div className="w-full text-xs rounded-lg border border-slate-200 bg-slate-100/80 px-3 py-2 text-slate-700 font-semibold truncate">
                  {currentUser.name} ({currentUser.role})
                </div>
              </div>

              {/* No Surat Jalan */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">No. Surat Jalan / Delivery Note</label>
                <input
                  type="text"
                  placeholder="Contoh: SJ-2026/09/8821"
                  value={formDeliveryNote}
                  onChange={e => setFormDeliveryNote(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Catatan / Keterangan */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
                <input
                  type="text"
                  placeholder="Contoh: Sayur diterima dalam box pendingin..."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Item Lines Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-slate-800">
                  Daftar Barang Diterima ({lines.length} Baris)
                </h4>
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Baris Barang
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Item Bahan Gudang <span className="text-rose-500">*</span></th>
                      <th className="py-2.5 px-3 w-32">Kategori</th>
                      <th className="py-2.5 px-3 w-28">Kuantitas Timbang <span className="text-rose-500">*</span></th>
                      <th className="py-2.5 px-3 w-20">Satuan</th>
                      <th className="py-2.5 px-3 min-w-[150px]">Kondisi & Catatan</th>
                      <th className="py-2.5 px-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-400 text-center">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <select
                            value={line.itemId}
                            onChange={e => handleLineItemChange(idx, e.target.value)}
                            className="w-full text-xs rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                          >
                            {items.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.category})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {line.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            value={line.quantity || ''}
                            onChange={e => handleLineQtyChange(idx, e.target.value)}
                            className="w-full text-xs rounded border border-slate-300 px-2 py-1.5 font-mono font-bold text-slate-900 focus:ring-1 focus:ring-emerald-500 text-right"
                            required
                          />
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-600">{line.unit}</td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            placeholder="Kondisi segar, kemasan baik..."
                            value={line.conditionNote || ''}
                            onChange={e => handleLineNoteChange(idx, e.target.value)}
                            className="w-full text-xs rounded border border-slate-200 px-2 py-1 text-slate-700 placeholder:text-slate-400"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            disabled={lines.length === 1}
                            className="text-slate-400 hover:text-rose-600 disabled:opacity-30 p-1 rounded transition-colors cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Photo Documentation Section */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
              <PhotoUploadCompressor
                photos={formPhotos}
                onChange={setFormPhotos}
                maxPhotos={6}
                folder="receiving"
                label="Dokumentasi Foto Kedatangan (Auto-Kompres WebP)"
                description="Foto surat jalan, timbangan, atau fisik kemasan barang. Otomatis dikompres ke WebP di HP karyawan sebelum diunggah."
              />
            </div>

            {/* Signature Section */}
            <div>
              <h4 className="text-xs font-semibold text-slate-800 mb-2">
                Verifikasi & Tanda Tangan Digital
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SignaturePad
                  label="Tanda Tangan Staf Pengirim / Supplier"
                  signatoryName={selectedSupplierObj ? `${selectedSupplierObj.contactPerson} (${selectedSupplierObj.name})` : 'Pemasok'}
                  initialValue={formSupplierSign}
                  onSave={val => setFormSupplierSign(val)}
                />
                <SignaturePad
                  label="Tanda Tangan Penerima / PIC Gudang"
                  signatoryName={`${currentUser.name} (${currentUser.role})`}
                  initialValue={formReceiverSign}
                  onSave={val => setFormReceiverSign(val)}
                />
              </div>
            </div>
          </div>

          {/* Footer controls */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => setIsCreatingDeliveryOrder(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              Simpan & Posting Penerimaan ke Stok
            </button>
          </div>
        </form>
      ) : (
        /* ========================================================================= */
        /* MAIN LIST VIEW */
        /* ========================================================================= */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Category Tabs & Filter */}
          <div className="px-5 pt-4 pb-3 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveCategoryTab('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeCategoryTab === 'ALL'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Semua Kategori ({unifiedRecords.length})
              </button>

              {INPUT_CATEGORIES.map(cat => {
                const count = unifiedRecords.filter(r => (r.displayCategory || r.category) === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategoryTab(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      activeCategoryTab === cat
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setActiveCategoryTab('SURAT_JALAN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeCategoryTab === 'SURAT_JALAN'
                    ? 'bg-emerald-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Surat Jalan Supplier ({receivings.length})
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari barang, toko, PIC..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Table of Records */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3 w-28">Tanggal & Jam</th>
                  <th className="py-3 px-3 w-36">Kategori</th>
                  <th className="py-3 px-3 min-w-[200px]">Nama Barang & Keterangan</th>
                  <th className="py-3 px-3 w-28 text-right">Jumlah & Satuan</th>
                  <th className="py-3 px-3 w-32 text-right">Estimasi Biaya</th>
                  <th className="py-3 px-3 min-w-[140px]">Toko / Supplier</th>
                  <th className="py-3 px-3 w-32">PIC Petugas</th>
                  <th className="py-3 px-2 text-center w-14">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400 italic">
                      Belum ada data barang atau pengeluaran yang sesuai filter saat ini.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r, idx) => {
                    const isBasah = (r.displayCategory || r.category).includes('Basah');
                    const isKering = (r.displayCategory || r.category).includes('Kering');
                    const isAtk = (r.displayCategory || r.category).includes('ATK');
                    const isBersih = (r.displayCategory || r.category).includes('Kebersihan');

                    let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                    if (isBasah) badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                    else if (isKering) badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
                    else if (isAtk) badgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
                    else if (isBersih) badgeColor = 'bg-cyan-50 text-cyan-800 border-cyan-200';

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          <div className="font-semibold text-slate-900">{r.date}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{r.time} WIB</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold border ${badgeColor}`}>
                            {r.displayCategory || r.category}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{r.itemName}</div>
                          {r.notes && (
                            <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                              {r.notes}
                            </div>
                          )}
                          {r.volunteer && (
                            <div className="text-[10px] text-slate-400">
                              Petugas belanja: <span className="font-medium text-slate-600">{r.volunteer}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {r.quantity} {r.unit}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="font-mono font-bold text-slate-900">
                            Rp {r.nominal.toLocaleString('id-ID')}
                          </div>
                          {r.unitPrice > 0 && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              @ Rp {r.unitPrice.toLocaleString('id-ID')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          <div className="font-semibold truncate max-w-[150px]">
                            {r.supplierOrStore !== '-' ? r.supplierOrStore : 'Belanja Rutin'}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          <div className="font-semibold truncate max-w-[120px]">{r.picOrUser}</div>
                        </td>
                        <td className="py-3 px-2 text-center">
                          {r.source === 'EXPENSE_INPUT' ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(r.id, r.itemName)}
                              className="text-slate-300 hover:text-rose-600 p-1.5 rounded transition-colors cursor-pointer"
                              title="Hapus catatan barang ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => r.rawDoc && setSelectedDocForDetail(r.rawDoc)}
                              className="text-slate-400 hover:text-emerald-700 p-1.5 rounded transition-colors cursor-pointer"
                              title="Lihat dokumen surat jalan"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INPUT SATUAN (SINGLE ITEM) */}
      {/* ========================================================================= */}
      {isSingleInputModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PackagePlus className="w-5 h-5 text-emerald-600" />
                  Input Satuan Barang & Belanja
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Catat satu per satu belanja bahan basah, bahan kering, ATK, kebersihan, atau keperluan operasional lainnya.
                </p>
              </div>
              <button
                onClick={() => setIsSingleInputModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSingleItem} className="p-6 space-y-4 text-xs">
              {/* Kategori */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kategori Barang & Belanja <span className="text-rose-500">*</span>
                </label>
                <select
                  value={singleCategory}
                  onChange={e => setSingleCategory(e.target.value as InputCategoryType)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="Barang Basah">Barang Basah (Ayam, Daging, Ikan, Telur, Sayur, Buah, Tahu/Tempe)</option>
                  <option value="Barang Kering">Barang Kering (Beras, Minyak, Gula, Tepung, Garam, Bumbu, Saus)</option>
                  <option value="ATK & Administrasi">ATK & Administrasi (Kertas HVS, Buku, Pulpen, Spidol, Map, Tinta)</option>
                  <option value="Alat Kebersihan">Alat Kebersihan (Sunlight, Karbol, Spons, Kain Lap, Sapu, Trash Bag)</option>
                  <option value="Perlengkapan & APD">Perlengkapan & APD (Kresek, Kotak Mika, Sarung Tangan, Masker, Nurse Cap)</option>
                  <option value="Operasional & Keperluan Lain">Operasional & Keperluan Lain (Gas Elpiji, Air Galon, Es Batu, Listrik)</option>
                </select>
              </div>

              {/* Nama Barang */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Barang <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  list="common-catalog-datalist"
                  value={singleItemName}
                  onChange={e => handleSingleItemChange(e.target.value)}
                  placeholder="Ketik atau pilih nama barang (contoh: Ayam Karkas, Sunlight, Kertas HVS)..."
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Jumlah & Satuan */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jumlah / Kuantitas <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={singleQty}
                    onChange={e => setSingleQty(e.target.value)}
                    placeholder="1"
                    required
                    className="w-full border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Satuan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="unit-datalist"
                    value={singleUnit}
                    onChange={e => setSingleUnit(e.target.value)}
                    placeholder="Kg, Pcs, Pack..."
                    required
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Harga Satuan & Subtotal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Harga Satuan (Rp)
                  </label>
                  <input
                    type="number"
                    value={singleUnitPrice || ''}
                    onChange={e => setSingleUnitPrice(Number(e.target.value))}
                    placeholder="Otomatis atau manual..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Estimasi Subtotal Biaya
                  </label>
                  <div className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-100 font-mono font-bold text-slate-800">
                    Rp {((parseFloat(singleQty) || 0) * (singleUnitPrice || 0)).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              {/* Tempat Belanja / Toko & Tanggal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Toko / Supplier / Pasar
                  </label>
                  <input
                    type="text"
                    value={singleSupplier}
                    onChange={e => setSingleSupplier(e.target.value)}
                    placeholder="Pasar Tumpang, Toko Berkah..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tanggal Pembelian
                  </label>
                  <input
                    type="date"
                    value={singleDate}
                    onChange={e => setSingleDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* PIC Gudang & Petugas Belanja */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    PIC Gudang Penerima
                  </label>
                  <input
                    type="text"
                    value={singlePic}
                    onChange={e => setSinglePic(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Relawan / Petugas Belanja
                  </label>
                  <input
                    type="text"
                    value={singleVolunteer}
                    onChange={e => setSingleVolunteer(e.target.value)}
                    placeholder="Nama staf belanja..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan / Keterangan Keperluan
                </label>
                <input
                  type="text"
                  value={singleNotes}
                  onChange={e => setSingleNotes(e.target.value)}
                  placeholder="Contoh: Belanja tambahan untuk menu siang..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSingleInputModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  Simpan Catatan Barang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INPUT MASAL (BATCH GRID & EXCEL PASTE) */}
      {/* ========================================================================= */}
      {isBatchInputModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TableProperties className="w-5 h-5 text-emerald-700" />
                  Input Masal Barang & Belanja (Multi-Baris)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Isi banyak barang sekaligus (barang basah, kering, ATK, kebersihan) dalam tabel atau tempel langsung data dari Excel.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setBatchInputMode('GRID')}
                    className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                      batchInputMode === 'GRID' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Tabel Cepat
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchInputMode('PASTE')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                      batchInputMode === 'PASTE' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>Tempel dari Excel</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsBatchInputModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Batch Date & PIC Header */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Belanja / Penerimaan
                  </label>
                  <input
                    type="date"
                    value={batchDate}
                    onChange={e => setBatchDate(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    PIC Petugas Gudang
                  </label>
                  <input
                    type="text"
                    value={batchPic}
                    onChange={e => setBatchPic(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* MODE 1: GRID TABLE */}
              {batchInputMode === 'GRID' && (
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                            <th className="py-2.5 px-2 text-center w-8">#</th>
                            <th className="py-2.5 px-2.5 min-w-[190px]">Nama Barang <span className="text-rose-500">*</span></th>
                            <th className="py-2.5 px-2 w-36">Kategori</th>
                            <th className="py-2.5 px-2 w-20 text-right">Jumlah</th>
                            <th className="py-2.5 px-2 w-20">Satuan</th>
                            <th className="py-2.5 px-2 w-24 text-right">Harga Satuan</th>
                            <th className="py-2.5 px-2 min-w-[120px]">Toko / Supplier</th>
                            <th className="py-2.5 px-2 min-w-[110px]">Keterangan</th>
                            <th className="py-2.5 px-1 text-center w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {batchRows.map((row, index) => (
                            <tr key={row.id} className="hover:bg-slate-50/80">
                              <td className="py-1.5 px-2 text-center text-slate-400 text-[11px]">
                                {index + 1}
                              </td>
                              <td className="py-1.5 px-2.5">
                                <input
                                  type="text"
                                  list="common-catalog-datalist"
                                  value={row.itemName}
                                  onChange={e => handleUpdateBatchRow(row.id, 'itemName', e.target.value)}
                                  placeholder="Ketik nama barang..."
                                  className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <select
                                  value={row.category}
                                  onChange={e => handleUpdateBatchRow(row.id, 'category', e.target.value as InputCategoryType)}
                                  className="w-full text-[11px] border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white text-slate-800 cursor-pointer"
                                >
                                  {INPUT_CATEGORIES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-1.5 px-2 text-right">
                                <input
                                  type="text"
                                  value={row.qty}
                                  onChange={e => handleUpdateBatchRow(row.id, 'qty', e.target.value)}
                                  placeholder="1"
                                  className="w-full text-xs border border-slate-200 rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  list="unit-datalist"
                                  value={row.unit}
                                  onChange={e => handleUpdateBatchRow(row.id, 'unit', e.target.value)}
                                  placeholder="Kg"
                                  className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900"
                                />
                              </td>
                              <td className="py-1.5 px-2 text-right">
                                <input
                                  type="number"
                                  value={row.unitPrice || ''}
                                  onChange={e => handleUpdateBatchRow(row.id, 'unitPrice', Number(e.target.value))}
                                  placeholder="0"
                                  className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 text-right font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.supplier}
                                  onChange={e => handleUpdateBatchRow(row.id, 'supplier', e.target.value)}
                                  placeholder="Toko / pasar..."
                                  className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.notes}
                                  onChange={e => handleUpdateBatchRow(row.id, 'notes', e.target.value)}
                                  placeholder="Catatan..."
                                  className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900"
                                />
                              </td>
                              <td className="py-1.5 px-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBatchRow(row.id)}
                                  disabled={batchRows.length <= 1}
                                  className="text-slate-300 hover:text-rose-500 disabled:opacity-20 cursor-pointer p-1"
                                  title="Hapus baris ini"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Add Row Controls & Total Summary */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddBatchRows(1)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah 1 Baris</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddBatchRows(5)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>+5 Baris</span>
                      </button>
                    </div>

                    <div className="text-xs text-slate-600 flex items-center gap-3">
                      <span>
                        Total baris terisi: <strong>{batchRows.filter(r => r.itemName.trim() !== '').length}</strong> / {batchRows.length}
                      </span>
                      <span className="font-mono font-bold text-emerald-800">
                        Total Estimasi: Rp {batchRows
                          .filter(r => r.itemName.trim() !== '')
                          .reduce((sum, r) => sum + (parseFloat(r.qty) || 1) * (r.unitPrice || 0), 0)
                          .toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 2: PASTE FROM EXCEL */}
              {batchInputMode === 'PASTE' && (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-0.5">Panduan Format Salin / Tempel dari Excel:</p>
                      <p className="text-[11px] text-emerald-900 leading-relaxed">
                        Salin (Copy - Ctrl+C) tabel dari Excel atau Google Sheet lalu tempel (Ctrl+V) ke kotak teks di bawah. Format kolom yang didukung:
                        <br />
                        <code className="bg-emerald-100 px-1 rounded font-mono text-[10px]">
                          [Nama Barang] [Tab] [Jumlah] [Tab] [Satuan] [Tab] [Harga Satuan] [Tab] [Toko/Supplier]
                        </code>{' '}
                        atau{' '}
                        <code className="bg-emerald-100 px-1 rounded font-mono text-[10px]">
                          [Nama Barang] [Tab] [Jumlah]
                        </code>.
                      </p>
                    </div>
                  </div>

                  <textarea
                    rows={8}
                    value={batchRawPaste}
                    onChange={e => setBatchRawPaste(e.target.value)}
                    placeholder="Tempel data Excel di sini (Ctrl+V)...&#10;Contoh:&#10;Daging Ayam Broiler&#9;25&#9;Kg&#9;38000&#9;Pasar Tumpang&#10;Beras Ramos&#9;50&#9;Kg&#9;14500&#9;Toko Berkah&#10;Kertas HVS A4&#9;2&#9;Rim&#9;48000&#9;Gramedia&#10;Sunlight 750ml&#9;4&#9;Pouch&#9;18500&#9;Superindo"
                    className="w-full text-xs font-mono border border-slate-300 rounded-xl p-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  />

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={handleParsePastedExcel}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      <ClipboardPaste className="w-4 h-4" />
                      <span>Ekstrak Data ke Tabel</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Semua barang yang diinput akan otomatis masuk ke Laporan Pengeluaran & update stok.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchInputModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveBatchRows}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  Simpan Semua Pengeluaran
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Autocomplete Datalists */}
      <datalist id="common-catalog-datalist">
        {COMMON_GOODS_CATALOG.map((c, i) => (
          <option key={i} value={c.name}>{c.category} - Rp {c.price.toLocaleString('id-ID')}/{c.unit}</option>
        ))}
        {items.map(it => (
          <option key={it.id} value={it.name}>{it.category} (Stok: {it.currentStock} {it.baseUnit})</option>
        ))}
      </datalist>

      <datalist id="unit-datalist">
        <option value="Kg" />
        <option value="Liter" />
        <option value="Gram" />
        <option value="Pcs" />
        <option value="Pack" />
        <option value="Ikat" />
        <option value="Dus" />
        <option value="Roll" />
        <option value="Pouch" />
        <option value="Botol" />
        <option value="Bungkus" />
        <option value="Rim" />
        <option value="Buku" />
        <option value="Tabung" />
        <option value="Galon" />
        <option value="Karung" />
      </datalist>
    </div>
  );
};
