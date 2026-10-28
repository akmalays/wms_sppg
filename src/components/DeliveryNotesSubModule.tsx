import React, { useState, useMemo, useEffect } from 'react';
import { Select } from './common/Select';
import { DateStepper } from './common/DateStepper';
import {
  Printer,
  Search,
  User,
  Plus,
  Trash2,
  RotateCcw,
  X,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { MenuOrder, SchoolBeneficiaryAllocation } from '../types/warehouse';
import logoSppgImg from '../assets/logo sppg.png';
import {localDateIso} from "../utils/localDate";
import { useConfirm } from '../context/ConfirmContext';
import { BTN_PRIMARY, BTN_SECONDARY, FIELD_INPUT, FOCUS_RING, TABLE_INPUT } from './common/FormDialog';
import { warehouseDb, APP_SETTINGS_CHANGED_EVENT } from '../db/storage';
import { useAuth } from '../context/AuthContext';
import { SPPG_ADDRESS } from './common/KopText';
import { getBeneficiaryRecap, SKIP_REASON_LABEL, SkipReason } from '../utils/beneficiaryRecap';
import { SuratJalanSheetLegacy, BeritaAcaraSheetLegacy, UjiHedonikSheetLegacy, DeliveryClassRow } from './print/DeliveryDocSheets';
import { SuratJalanSheetStandard, BeritaAcaraSheetStandard, UjiHedonikSheetStandard } from './print/DeliveryDocSheetsStandard';
import { SuratJalanBastSheetCompact } from './print/DeliveryDocSheetsCompact';
import { ensureHedonicLinks, hedonicUrl, HEDONIC_DAYS_OPEN } from '../utils/hedonic';
import { getRomanMonth } from '../utils/poNumberGenerator';
import { SignaturePad } from './SignaturePad';

export interface ClassBreakdownItem {
  id: string;
  className: string;
  portions: number;
  notes?: string;
}

export interface DeliveryOfficerSettings {
  nutritionistName: string;
  fieldAssistantName: string;
  headName: string;
  /** Kosong = dicetak bergaris untuk ditulis tangan (driver bisa berganti tiap hari). */
  driverName: string;
  /** Jam batas makan di Berita Acara Penerimaan, mis. "11:00". */
  consumeBefore: string;
  /** Tanda tangan Kepala SPPG (data URL gambar), dicetak di kotak Mengetahui. */
  headSignature?: string;
  // Field lama, tidak lagi dicetak
  nutritionistTitle?: string;
  vehicleNumber?: string;
  pickupTimeRange?: string;
}

// Nama sesuai dokumen pengiriman SPPG Malang Tumpang Jeru; bisa diubah lewat tombol Petugas.
const DEFAULT_OFFICERS: DeliveryOfficerSettings = {
  nutritionistName: 'Eno Shafira Ramadanti, A.md.Gz',
  fieldAssistantName: 'Mukhammad Ali Akbar Fathoni, S.Pd',
  headName: 'Rizky Iman Ramadhan, S.Pd.',
  driverName: '',
  consumeBefore: '11:00',
};

// Isian kosong di dokumen cetak dibiarkan bertitik agar diisi tangan, bukan diganti tebakan.
const BLANK = '....................';

// Disimpan di tabel app_settings (lihat warehouseDb.saveAppSetting) agar sama di semua perangkat.
const SETTING_CLASSES = 'delivery_class_breakdowns';
const SETTING_OFFICERS = 'delivery_officers';
const SETTING_DOC_FORMAT = 'delivery_doc_format';
// Format ringkas: uji hedonik lewat QR di surat jalan, lembar kertasnya tidak ikut dicetak
const SETTING_HEDONIC_QR = 'delivery_hedonic_qr';
// RINGKAS: surat jalan dan berita acara digabung, 2 halaman per sekolah
type DocFormat = 'STANDARD' | 'LEGACY' | 'RINGKAS';

// Isian petugas yang kosong diisi dari jabatan karyawan aktif.
const loadOfficers = (): DeliveryOfficerSettings => {
  const saved = warehouseDb.getAppSetting<Partial<DeliveryOfficerSettings>>(SETTING_OFFICERS, {});
  return {
    ...DEFAULT_OFFICERS,
    ...saved,
    nutritionistName: saved.nutritionistName || DEFAULT_OFFICERS.nutritionistName,
    fieldAssistantName: saved.fieldAssistantName || DEFAULT_OFFICERS.fieldAssistantName,
    headName: saved.headName || DEFAULT_OFFICERS.headName,
    consumeBefore: saved.consumeBefore || DEFAULT_OFFICERS.consumeBefore,
  };
};

// Baris kelas bawaan di surat jalan, mengikuti format kertas SPPG (Kelompok A/B, Guru dan Tendik, PIC).
export function defaultClassNames(category: string, schoolName: string): string[] {
  if (category === 'PAUD / TK') return ['Kelompok A', 'Kelompok B', 'Guru dan Tendik', 'PIC'];
  if (category === 'SMP / MTs') return ['Kelas 7', 'Kelas 8', 'Kelas 9', 'Guru dan Tendik', 'PIC'];
  if (category === 'SMA / MA') return ['Kelas 10', 'Kelas 11', 'Kelas 12', 'Guru dan Tendik', 'PIC'];
  if (category === 'Ibu Hamil & Balita (B3)') return [schoolName, 'PIC'];
  return ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6', 'Guru dan Tendik', 'PIC'];
}

export function getDefaultClassesForSchool(
  category: string,
  totalPortions: number,
  schoolName = ''
): ClassBreakdownItem[] {
  // PIC tidak dihitung porsi bawaan; sisanya dibagi rata ke kelas, guru mendapat bagian kecil.
  const baseNames = defaultClassNames(category, schoolName).filter(n => n !== 'PIC');

  const numUnits = baseNames.length;
  if (numUnits === 0) return [];
  // Kelompok 3B (Balita/Busui/Bumil) hanya satu baris: seluruh porsi
  if (numUnits === 1) return [{ id: 'cls-1', className: baseNames[0], portions: totalPortions, notes: '' }];

  // Porsi per rombel secara proporsional
  const lastIndex = numUnits - 1;
  // Sisihkan porsi untuk guru / kader lebih kecil (misal 5-10% atau 10 porsi jika memungkinkan)
  const teacherPortion = Math.max(2, Math.min(15, Math.floor(totalPortions * 0.05)));
  const studentTotal = Math.max(0, totalPortions - teacherPortion);
  const studentClassesCount = lastIndex;

  const perClass = studentClassesCount > 0 ? Math.floor(studentTotal / studentClassesCount) : totalPortions;
  let remainder = studentClassesCount > 0 ? studentTotal - (perClass * studentClassesCount) : 0;

  return baseNames.map((name, idx) => {
    let portions = 0;
    if (idx === lastIndex) {
      portions = teacherPortion;
    } else {
      portions = perClass + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
    }

    return {
      id: `cls-${idx + 1}`,
      className: name,
      portions: Math.max(0, portions),
      notes: idx === lastIndex ? 'Khusus Guru/Pendamping' : 'Porsi Standar Siswa'
    };
  });
}

// Kop surat ketiga lembar pengiriman. Alamat diambil dari KopText agar sama dengan dokumen lain.
const DeliveryKop: React.FC = () => (
  <div className="flex items-center gap-3.5 pb-2 border-b-2 border-black">
    <img src={logoSppgImg} alt="Logo SPPG" className="w-14 h-14 object-contain shrink-0" />
    <div className="flex-1 text-center pr-14">
      <div className="text-[11px] font-bold text-slate-900 leading-tight">BADAN GIZI NASIONAL</div>
      <h1 className="text-sm font-bold text-slate-950 leading-tight">
        SATUAN PELAYANAN PEMENUHAN GIZI (SPPG) MLG TUMPANG JERU
      </h1>
      <p className="text-[9.5px] text-slate-700 leading-tight mt-0.5">{SPPG_ADDRESS}</p>
    </div>
  </div>
);

function formatIndonesianDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  try {
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, monthIdx, day);
      const dayName = days[d.getDay()] || '';
      return `${dayName}, ${day} ${months[monthIdx]} ${year}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function dayNameOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()] || '';
}

// Format tanggal pendek seperti di dokumen kertas: 28-9-26
function shortDocDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}-${m}-${String(y).slice(2)}`;
}

interface DeliveryNotesSubModuleProps {
  orders: MenuOrder[];
  masterSchools: SchoolBeneficiaryAllocation[];
  currentDate: string;
  onSelectDate?: (date: string) => void;
}

export const DeliveryNotesSubModule: React.FC<DeliveryNotesSubModuleProps> = ({
  orders,
  masterSchools,
  currentDate,
  onSelectDate
}) => {
  const askConfirm = useConfirm();
  const [selectedDate, setSelectedDate] = useState<string>(currentDate);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Petugas Pengiriman
  const { currentUser } = useAuth();
  const [officerSettings, setOfficerSettings] = useState<DeliveryOfficerSettings>(loadOfficers);
  const [isOfficerModalOpen, setIsOfficerModalOpen] = useState(false);
  const [officerDraft, setOfficerDraft] = useState<DeliveryOfficerSettings>(officerSettings);
  const missingOfficerFields = [
    !officerSettings.nutritionistName.trim() && 'ahli gizi',
    !officerSettings.fieldAssistantName.trim() && 'asisten lapangan',
    !officerSettings.headName.trim() && 'kepala SPPG',
  ].filter(Boolean) as string[];

  // Kustomisasi Rincian Kelas per sekolah (Key: schoolId_date atau schoolId)
  const [customClassBreakdowns, setCustomClassBreakdowns] = useState<Record<string, ClassBreakdownItem[]>>(
    () => warehouseDb.getAppSetting<Record<string, ClassBreakdownItem[]>>(SETTING_CLASSES, {})
  );

  // Data dari cloud atau perangkat lain tiba setelah tab dibuka.
  useEffect(() => {
    const reload = () => {
      setRecapVersion(v => v + 1);
      setOfficerSettings(loadOfficers());
      setCustomClassBreakdowns(warehouseDb.getAppSetting<Record<string, ClassBreakdownItem[]>>(SETTING_CLASSES, {}));
    };
    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, reload);
  }, []);

  // Naik saat app_settings berubah, agar rekap penerima manfaat terbaru ikut terbaca
  const [recapVersion, setRecapVersion] = useState(0);

  // Modal Atur Kelas
  const [editingSchoolForClass, setEditingSchoolForClass] = useState<SchoolBeneficiaryAllocation | null>(null);
  const [tempClassItems, setTempClassItems] = useState<ClassBreakdownItem[]>([]);

  // Modal Cetak 3 Lembar (Single School or Batch All)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printSchoolsQueue, setPrintSchoolsQueue] = useState<SchoolBeneficiaryAllocation[]>([]);
  const [printSheetTab, setPrintSheetTab] = useState<'ALL' | 'SHEET_1' | 'SHEET_2' | 'SHEET_3'>('ALL');
  // Format standar (wording rapi) atau format kertas lama; pilihan disimpan untuk semua perangkat
  const [docFormat, setDocFormat] = useState<DocFormat>(() => warehouseDb.getAppSetting<DocFormat>(SETTING_DOC_FORMAT, 'STANDARD'));
  const changeDocFormat = (f: DocFormat) => {
    setDocFormat(f);
    // Format ringkas tidak punya lembar berita acara terpisah
    if (f === 'RINGKAS' && printSheetTab === 'SHEET_2') setPrintSheetTab('ALL');
    warehouseDb.saveAppSetting(SETTING_DOC_FORMAT, f, currentUser || undefined);
  };
  const [hedonicQr, setHedonicQr] = useState<boolean>(() => warehouseDb.getAppSetting<boolean>(SETTING_HEDONIC_QR, true));
  const changeHedonicQr = (on: boolean) => {
    setHedonicQr(on);
    warehouseDb.saveAppSetting(SETTING_HEDONIC_QR, on, currentUser || undefined);
  };
  // Kode QR per sekolah (id sekolah -> kode) untuk menu yang sedang dicetak
  const [hedonicTokens, setHedonicTokens] = useState<Record<string, string>>({});
  const [hedonicState, setHedonicState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  // Sync date from parent
  useEffect(() => {
    if (currentDate && currentDate !== selectedDate) {
      setSelectedDate(currentDate);
    }
  }, [currentDate]);

  const changeDate = (iso: string) => {
    setSelectedOrderId('');
    setSelectedDate(iso);
    if (onSelectDate) onSelectDate(iso);
  };

  useEffect(() => {
    if (!isOfficerModalOpen && !editingSchoolForClass && !isPrintModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setIsOfficerModalOpen(false);
      setEditingSchoolForClass(null);
      setIsPrintModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOfficerModalOpen, editingSchoolForClass, isPrintModalOpen]);

  // Menu dikirim sekali sehari; beberapa sesi di satu tanggal hanya ada di data lama.
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const dayOrders = useMemo(
    () => orders
      .filter(o => o.date === selectedDate && o.status !== 'CANCELLED')
      .sort((a, b) => ['Pagi', 'Siang', 'Snack'].indexOf(a.mealSession) - ['Pagi', 'Siang', 'Snack'].indexOf(b.mealSession)),
    [orders, selectedDate]
  );

  // Order pada tanggal terpilih
  const currentOrder = useMemo(() => {
    return dayOrders.find(o => o.id === selectedOrderId) ?? dayOrders[0];
  }, [dayOrders, selectedOrderId]);

  // Daftar tanggal order menu yang tersedia
  const distinctOrderDates = useMemo(() => {
    return Array.from(new Set(orders.map(o => o.date))).sort();
  }, [orders]);

  // Alokasi porsi tiap sekolah pada tanggal terpilih
  // Urutan sumber angka: rekap harian tersimpan → alokasi di menu → porsi standar sekolah
  const schoolAllocationsForDate = useMemo(() => {
    const recap = getBeneficiaryRecap(selectedDate);
    return masterSchools.map(school => {
      let portion = school.portionCount;
      const recapEntry = recap?.entries.find(e => e.schoolId === school.id);
      if (recap) {
        portion = recapEntry ? recapEntry.count : 0;
      } else if (currentOrder?.beneficiaryAllocations) {
        const found = currentOrder.beneficiaryAllocations.find(b => b.id === school.id);
        if (found && typeof found.portionCount === 'number') {
          portion = found.portionCount;
        }
      }
      return {
        ...school,
        dailyPortion: portion,
        skipReason: recapEntry?.skipReason as SkipReason | undefined,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterSchools, currentOrder, selectedDate, recapVersion]);

  // Filter sekolah
  const filteredSchools = useMemo(() => {
    return schoolAllocationsForDate.filter(s => {
      const matchCat = selectedCategory === 'ALL' || s.category === selectedCategory;
      const matchSearch =
        s.schoolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.notes && s.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [schoolAllocationsForDate, selectedCategory, searchQuery]);

  // Total porsi keseluruhan hari terpilih
  const totalPortionsForDay = useMemo(() => {
    return schoolAllocationsForDate.reduce((sum, s) => sum + (s.dailyPortion || 0), 0);
  }, [schoolAllocationsForDate]);

  // Helper untuk mendapatkan breakdown kelas per sekolah
  const getSchoolClassBreakdown = (schoolId: string, category: string, totalPortion: number, schoolName = ''): ClassBreakdownItem[] => {
    const keyWithDate = `${schoolId}_${selectedDate}`;
    if (customClassBreakdowns[keyWithDate]) {
      return customClassBreakdowns[keyWithDate];
    }
    if (customClassBreakdowns[schoolId]) {
      return customClassBreakdowns[schoolId];
    }
    return getDefaultClassesForSchool(category, totalPortion, schoolName);
  };

  // Buka editor kelas
  const handleOpenClassEditor = (school: SchoolBeneficiaryAllocation & { dailyPortion: number }) => {
    setEditingSchoolForClass(school);
    const existing = getSchoolClassBreakdown(school.id, school.category, school.dailyPortion, school.schoolName);
    setTempClassItems(JSON.parse(JSON.stringify(existing)));
  };

  // Simpan hasil edit kelas
  const handleSaveClassBreakdown = async () => {
    if (!editingSchoolForClass) return;
    const target = (editingSchoolForClass as SchoolBeneficiaryAllocation & { dailyPortion?: number }).dailyPortion || editingSchoolForClass.portionCount;
    const sum = tempClassItems.reduce((acc, c) => acc + (Number(c.portions) || 0), 0);
    if (sum !== target && !(await askConfirm({
      title: 'Total kelas tidak sama dengan porsi sekolah',
      message: `Rincian kelas ${sum.toLocaleString('id-ID')} porsi, sedangkan porsi sekolah hari ini ${target.toLocaleString('id-ID')}. Surat jalan akan mencetak angka yang berbeda.`,
      confirmText: 'Tetap simpan',
      variant: 'warning',
    }))) return;
    const key = `${editingSchoolForClass.id}_${selectedDate}`;
    const nextMap = {
      ...customClassBreakdowns,
      [key]: tempClassItems
    };
    setCustomClassBreakdowns(nextMap);
    warehouseDb.saveAppSetting(SETTING_CLASSES, nextMap, currentUser || undefined);
    setEditingSchoolForClass(null);
  };

  // Reset kelas ke default proporsional
  const handleResetClassToDefault = () => {
    if (!editingSchoolForClass) return;
    const dailyP = (editingSchoolForClass as any).dailyPortion || editingSchoolForClass.portionCount;
    const def = getDefaultClassesForSchool(editingSchoolForClass.category, dailyP, editingSchoolForClass.schoolName);
    setTempClassItems(def);
  };

  // Baris kelas di surat jalan: rincian yang diatur lewat "Atur kelas" beserta porsinya,
  // atau baris bawaan dengan porsi kosong untuk diisi tangan (seperti dokumen kertas).
  const printClassRows = (school: SchoolBeneficiaryAllocation, _dailyP: number): DeliveryClassRow[] => {
    const custom = customClassBreakdowns[`${school.id}_${selectedDate}`] || customClassBreakdowns[school.id];
    if (custom && custom.length > 0) return custom.map(c => ({ className: c.className, portions: Number(c.portions) || 0 }));
    return defaultClassNames(school.category, school.schoolName).map(className => ({ className }));
  };

  // Nomor dokumen tetap per sekolah: urutan sekolah berporsi pada tanggal itu (bukan urutan antrean cetak),
  // jadi cetak satu sekolah atau cetak semua menghasilkan nomor yang sama. Sesi ditambahkan bila sehari ada >1 sesi.
  const docSeqBySchool = useMemo(() => {
    const map: Record<string, string> = {};
    schoolAllocationsForDate
      .filter(s => s.dailyPortion > 0)
      .forEach((s, i) => {
        map[s.id] = String(i + 1).padStart(2, '0');
      });
    return map;
  }, [schoolAllocationsForDate]);
  const sessionCode =
    dayOrders.length > 1 && currentOrder ? `-${currentOrder.mealSession.slice(0, 2).toUpperCase()}` : '';

  // Sekolah di antrean cetak yang rincian kelasnya tidak sama dengan porsi hari itu
  const printMismatches = useMemo(
    () =>
      printSchoolsQueue
        .map(school => {
          const dailyP = (school as SchoolBeneficiaryAllocation & { dailyPortion?: number }).dailyPortion || school.portionCount;
          const custom = customClassBreakdowns[`${school.id}_${selectedDate}`] || customClassBreakdowns[school.id];
          const classTotal = (custom || []).reduce((sum, c) => sum + (Number(c.portions) || 0), 0);
          return { school, dailyP, classTotal, hasCustom: Boolean(custom && custom.length > 0) };
        })
        .filter(m => m.hasCustom && m.classTotal !== m.dailyP),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [printSchoolsQueue, customClassBreakdowns, selectedDate]
  );
  const isCompactDoc = docFormat === 'RINGKAS';
  const wantsHedonicQr = isPrintModalOpen && isCompactDoc && hedonicQr && !!currentOrder;

  useEffect(() => {
    if (!wantsHedonicQr || !currentOrder) return;
    let cancelled = false;
    setHedonicState('loading');
    ensureHedonicLinks(currentOrder, printSchoolsQueue)
      .then(tokens => {
        if (cancelled) return;
        setHedonicTokens(tokens);
        setHedonicState('ready');
      })
      .catch(err => {
        console.error('Gagal membuat QR uji hedonik:', err);
        if (!cancelled) setHedonicState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [wantsHedonicQr, currentOrder, printSchoolsQueue]);

  // Sekolah tanpa QR (menu belum ada, gagal dibuat) tetap mendapat lembar uji hedonik kertas
  const hedonicTokenFor = (schoolId: string) => (wantsHedonicQr && hedonicState === 'ready' ? hedonicTokens[schoolId] : undefined);
  const sheetsFor = (schoolId: string) => {
    if (printSheetTab !== 'ALL') return 1;
    if (!isCompactDoc) return 3;
    return hedonicTokenFor(schoolId) ? 1 : 2;
  };
  const printPageCount = printSchoolsQueue.reduce((sum, s) => sum + sheetsFor(s.id), 0);

  // Buka modal cetak untuk 1 sekolah
  const handlePrintSingleSchool = (school: SchoolBeneficiaryAllocation) => {
    setPrintSchoolsQueue([school]);
    setPrintSheetTab('ALL');
    setIsPrintModalOpen(true);
  };

  // Buka modal cetak untuk seluruh sekolah aktif
  const schoolsToPrint = filteredSchools.filter(s => s.dailyPortion > 0);
  const handlePrintAllSchools = () => {
    if (schoolsToPrint.length === 0) return;
    setPrintSchoolsQueue(schoolsToPrint);
    setPrintSheetTab('ALL');
    setIsPrintModalOpen(true);
  };

  // Simpan pengaturan petugas
  const openOfficerModal = () => {
    setOfficerDraft(officerSettings);
    setIsOfficerModalOpen(true);
  };

  const handleSaveOfficers = () => {
    setOfficerSettings(officerDraft);
    warehouseDb.saveAppSetting(SETTING_OFFICERS, officerDraft, currentUser || undefined);
    setIsOfficerModalOpen(false);
  };

  // Pemicu cetak langsung
  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Tanggal, ringkasan, dan aksi */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <DateStepper ariaLabel="Tanggal distribusi" value={selectedDate} onChange={changeDate} />
            {distinctOrderDates.length > 0 && (
              <Select className="w-48"
                aria-label="Lompat ke tanggal bermenu"
                value={distinctOrderDates.includes(selectedDate) ? selectedDate : ''}
                onChange={e => e.target.value && changeDate(e.target.value)}>
                <option value="">Tanggal bermenu…</option>
                {distinctOrderDates.map(d => (
                  <option key={d} value={d}>
                    {formatIndonesianDate(d)}
                  </option>
                ))}
              </Select>
            )}
            {dayOrders.length > 1 && (
              <div role="tablist" aria-label="Sesi makan" className="inline-flex gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                {dayOrders.map(o => (
                  <button
                    key={o.id}
                    type="button"
                    role="tab"
                    aria-selected={currentOrder?.id === o.id}
                    onClick={() => setSelectedOrderId(o.id)}
                    className={`px-3 rounded-md cursor-pointer min-h-[44px] sm:min-h-[30px] ${FOCUS_RING} ${
                      currentOrder?.id === o.id ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    {o.mealSession}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={openOfficerModal} className={BTN_SECONDARY} title="Pemeriksa ahli gizi, asisten lapangan, dan kendaraan">
              <User className="w-4 h-4" />
              Petugas
            </button>
            <button
              type="button"
              onClick={handlePrintAllSchools}
              disabled={schoolsToPrint.length === 0 || !currentOrder}
              className={BTN_PRIMARY}
              title={currentOrder ? 'Dokumen pengiriman untuk semua sekolah yang tampil di daftar' : 'Catat menu tanggal ini dulu di tab Menu & PO'}
            >
              <Printer className="w-4 h-4" />
              Cetak {schoolsToPrint.length} sekolah
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pt-3 border-t border-slate-200">
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900">{formatIndonesianDate(selectedDate)}</div>
            <div className={`text-xs mt-0.5 truncate ${currentOrder ? 'text-slate-600' : 'text-amber-800'}`}>
              {currentOrder ? `${dayOrders.length > 1 ? `${currentOrder.mealSession} · ` : ''}${currentOrder.menuTitle}` : 'Belum ada menu untuk tanggal ini. Catat menunya dulu di tab Menu & PO.'}
            </div>
          </div>
          <div className="flex items-end gap-5 shrink-0 text-right">
            <div>
              <div className="text-[11px] text-slate-600">Total porsi</div>
              <div className="text-lg font-bold text-slate-900 tabular-nums">{totalPortionsForDay.toLocaleString('id-ID')}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-600">Sekolah</div>
              <div className="text-lg font-bold text-slate-900 tabular-nums">{schoolAllocationsForDate.filter(x => x.dailyPortion > 0).length}</div>
            </div>
          </div>
        </div>

        {missingOfficerFields.length > 0 && (
          <div role="note" className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900">
            <span>
              Data petugas belum lengkap ({missingOfficerFields.join(', ')}). Bagian itu akan tercetak kosong di surat jalan.
            </span>
            <button type="button" onClick={openOfficerModal} className={`${BTN_SECONDARY} shrink-0`}>
              Isi petugas
            </button>
          </div>
        )}

      </div>

      {/* 2. Daftar sekolah: porsi, jadwal, PIC, kelas, dan cetak per sekolah */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center gap-2">
          <Select size="sm"
            aria-label="Kategori sekolah"
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}>
            <option value="ALL">Semua kategori ({schoolAllocationsForDate.length})</option>
            {Array.from(new Set(schoolAllocationsForDate.map(x => x.category))).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
            <input
              type="search"
              aria-label="Cari sekolah"
              placeholder="Cari sekolah, PIC, catatan"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`${TABLE_INPUT} pl-8`}
            />
          </div>
        </div>
        {filteredSchools.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-600">
            {schoolAllocationsForDate.length === 0 ? 'Belum ada data sekolah. Tambahkan di tab Data Sekolah.' : 'Tidak ada sekolah yang cocok dengan filter.'}
          </p>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <th className="py-2 px-4 font-semibold min-w-[220px]">Sekolah</th>
                <th className="py-2 px-3 font-semibold w-28 text-right">Porsi</th>
                <th className="py-2 px-3 font-semibold w-24">Jam kirim</th>
                <th className="py-2 px-3 font-semibold w-44">PIC</th>
                <th className="py-2 px-3 font-semibold w-36">Kelas</th>
                <th className="py-2 px-3 font-semibold w-24"><span className="sr-only">Cetak</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSchools.map(s => {
                const breakdown = getSchoolClassBreakdown(s.id, s.category, s.dailyPortion, s.schoolName);
                const hasCustom = Boolean(customClassBreakdowns[`${s.id}_${selectedDate}`] || customClassBreakdowns[s.id]);
                const notSent = !!s.skipReason || s.dailyPortion <= 0;

                return (
                  <tr key={s.id} className={notSent ? 'bg-slate-50/60' : 'hover:bg-slate-50/80'}>
                    <td className="py-2.5 px-4">
                      <div className={`font-semibold ${notSent ? 'text-slate-500' : 'text-slate-900'}`}>{s.schoolName}</div>
                      <div className="text-[11px] text-slate-600 truncate max-w-xs">
                        {s.category}
                        {s.notes ? ` · ${s.notes}` : ''}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {s.skipReason ? (
                        <span className="text-[11px] text-slate-600">Tidak kirim · {SKIP_REASON_LABEL[s.skipReason]}</span>
                      ) : (
                        <span className={`font-semibold ${s.dailyPortion > 0 ? 'text-slate-900' : 'text-slate-500'}`}>
                          {s.dailyPortion.toLocaleString('id-ID')}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 tabular-nums">{s.deliveryTime || '-'}</td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-900">{s.contactPerson || '-'}</div>
                      {s.phone && <div className="text-[11px] text-slate-600 tabular-nums">{s.phone}</div>}
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => handleOpenClassEditor(s)}
                        className={`text-left rounded-md cursor-pointer min-h-[44px] sm:min-h-0 hover:underline ${FOCUS_RING}`}
                        title="Atur jumlah porsi per kelas di surat jalan"
                      >
                        <span className="text-slate-800">{breakdown.length} kelas</span>
                        <span className={hasCustom ? 'text-slate-600' : 'text-emerald-800 font-medium'}>
                          {hasCustom ? ' · diatur' : ' · atur'}
                        </span>
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handlePrintSingleSchool(s)}
                        disabled={!currentOrder || notSent}
                        className={`${BTN_SECONDARY} disabled:opacity-50 disabled:cursor-not-allowed`}
                        title="Pratinjau dan cetak dokumen pengiriman sekolah ini"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Cetak
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-900">
                <td className="py-2.5 px-4 text-right">Total</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{totalPortionsForDay.toLocaleString('id-ID')}</td>
                <td colSpan={4} className="py-2.5 px-3 text-[11px] font-normal text-slate-600">
                  Jumlah lembar per sekolah mengikuti format yang dipilih di jendela cetak.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: PENGATURAN PETUGAS DISTRIBUSI & KENDARAAN                        */}
      {/* ========================================================================= */}
      {isOfficerModalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-sm">Petugas di dokumen pengiriman</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOfficerModalOpen(false)}
                aria-label="Tutup"
                className={`p-2 -m-1 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer ${FOCUS_RING}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor="officer-nutritionistName" className="block font-semibold text-slate-700 mb-1">Ahli Gizi SPPG</label>
                <input
                  id="officer-nutritionistName"
                  type="text"
                  value={officerDraft.nutritionistName || ''}
                  onChange={e => setOfficerDraft(prev => ({ ...prev, nutritionistName: e.target.value }))}
                  className={FIELD_INPUT}
                  placeholder="Nama lengkap & gelar"
                />
                <p className="mt-0.5 text-[11px] text-slate-500">Tanda tangan "Diperiksa oleh" di surat jalan.</p>
              </div>
              <div>
                <label htmlFor="officer-fieldAssistantName" className="block font-semibold text-slate-700 mb-1">Asisten Lapangan</label>
                <input
                  id="officer-fieldAssistantName"
                  type="text"
                  value={officerDraft.fieldAssistantName || ''}
                  onChange={e => setOfficerDraft(prev => ({ ...prev, fieldAssistantName: e.target.value }))}
                  className={FIELD_INPUT}
                  placeholder="Nama lengkap & gelar"
                />
                <p className="mt-0.5 text-[11px] text-slate-500">Tanda tangan "Diperiksa oleh" di surat jalan.</p>
              </div>
              <div>
                <label htmlFor="officer-headName" className="block font-semibold text-slate-700 mb-1">Kepala SPPG</label>
                <input
                  id="officer-headName"
                  type="text"
                  value={officerDraft.headName || ''}
                  onChange={e => setOfficerDraft(prev => ({ ...prev, headName: e.target.value }))}
                  className={FIELD_INPUT}
                  placeholder="Nama lengkap & gelar"
                />
                <p className="mt-0.5 text-[11px] text-slate-500">Kotak "Mengetahui" di berita acara.</p>
              </div>

              {/* Tanda tangan Kepala SPPG: digambar langsung atau unggah foto/scan tanda tangan */}
              <div className="space-y-2">
                <SignaturePad
                  label="Tanda tangan Kepala SPPG"
                  signatoryName={officerDraft.headName || 'Kepala SPPG'}
                  initialValue={officerDraft.headSignature}
                  onSave={data => setOfficerDraft(prev => ({ ...prev, headSignature: data.startsWith('data:image') ? data : '' }))}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className={`${BTN_SECONDARY} cursor-pointer`}>
                    Unggah gambar tanda tangan
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        if (file.size > 500 * 1024) {
                          window.alert('Gambar terlalu besar (maks. 500 KB). Potong atau kecilkan dulu.');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => setOfficerDraft(prev => ({ ...prev, headSignature: String(reader.result || '') }));
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {officerDraft.headSignature?.startsWith('data:image') && (
                    <>
                      <img src={officerDraft.headSignature} alt="Pratinjau tanda tangan" className="h-10 object-contain border border-slate-200 rounded bg-white px-1" />
                      <button
                        type="button"
                        onClick={() => setOfficerDraft(prev => ({ ...prev, headSignature: '' }))}
                        className="text-[11px] font-semibold text-rose-700 hover:underline cursor-pointer"
                      >
                        Hapus tanda tangan
                      </button>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Paling rapi memakai foto tanda tangan di kertas putih (PNG latar transparan lebih baik). Dicetak di kotak Mengetahui.
                </p>
              </div>
              <div>
                <label htmlFor="officer-driverName" className="block font-semibold text-slate-700 mb-1">Driver</label>
                <input
                  id="officer-driverName"
                  type="text"
                  value={officerDraft.driverName || ''}
                  onChange={e => setOfficerDraft(prev => ({ ...prev, driverName: e.target.value }))}
                  className={FIELD_INPUT}
                  placeholder="Kosongkan bila driver berganti-ganti"
                />
                <p className="mt-0.5 text-[11px] text-slate-500">Kosong = dicetak bergaris untuk ditulis tangan.</p>
              </div>
              <div>
                <label htmlFor="officer-consumeBefore" className="block font-semibold text-slate-700 mb-1">Baik dimakan sebelum pukul</label>
                <input
                  id="officer-consumeBefore"
                  type="text"
                  value={officerDraft.consumeBefore || ''}
                  onChange={e => setOfficerDraft(prev => ({ ...prev, consumeBefore: e.target.value }))}
                  className={FIELD_INPUT}
                  placeholder="11:00"
                />
                <p className="mt-0.5 text-[11px] text-slate-500">Tulisan merah di Berita Acara Penerimaan.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsOfficerModalOpen(false)}
                className={`${BTN_SECONDARY} border-transparent bg-transparent hover:bg-slate-100`}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveOfficers}
                className={BTN_PRIMARY}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ATUR RINCIAN KELAS / SASARAN PER SEKOLAH                        */}
      {/* ========================================================================= */}
      {editingSchoolForClass && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-xl w-full p-5 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Atur Rincian Kelas - {editingSchoolForClass.schoolName}
                </h3>
                <p className="text-xs text-slate-500">
                  Target Alokasi Hari Ini:{' '}
                  <strong className="text-slate-800 font-mono">
                    {((editingSchoolForClass as any).dailyPortion || editingSchoolForClass.portionCount).toLocaleString('id-ID')}
                  </strong>{' '}
                  porsi
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSchoolForClass(null)}
                aria-label="Tutup"
                className={`p-2 -m-1 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer ${FOCUS_RING}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">Daftar Rombel / Tingkat Kelas:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetClassToDefault}
                    className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                    title="Hitung ulang otomatis porsi per kelas"
                  >
                    <RotateCcw className="w-3 h-3 text-slate-500" />
                    <span>Hitung Rata</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newId = `cls-${Date.now()}`;
                      setTempClassItems(prev => [
                        ...prev,
                        { id: newId, className: `Kelas Baru`, portions: 0, notes: 'Porsi Standar' }
                      ]);
                    }}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Kelas</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {tempClassItems.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                  >
                    <span className="text-slate-500 font-mono w-5 text-center">{idx + 1}</span>
                    <input
                      type="text"
                      value={item.className}
                      onChange={e => {
                        const val = e.target.value;
                        setTempClassItems(prev =>
                          prev.map((c, i) => (i === idx ? { ...c, className: val } : c))
                        );
                      }}
                      className="flex-1 px-2.5 py-1 border border-slate-300 rounded font-semibold text-slate-900 bg-white"
                      placeholder="Nama Kelas / Rombel..."
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={item.portions}
                        onChange={e => {
                          const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                          setTempClassItems(prev =>
                            prev.map((c, i) => (i === idx ? { ...c, portions: val } : c))
                          );
                        }}
                        className="w-16 px-2 py-1 border border-slate-300 rounded font-mono font-bold text-right text-slate-900 bg-white"
                      />
                      <span className="text-slate-500 text-[11px]">porsi</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTempClassItems(prev => prev.filter((_, i) => i !== idx));
                      }}
                      className="p-1 text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
                      title="Hapus Kelas"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Total Check */}
              {(() => {
                const target = (editingSchoolForClass as any).dailyPortion || editingSchoolForClass.portionCount;
                const sum = tempClassItems.reduce((acc, c) => acc + (Number(c.portions) || 0), 0);
                const diff = sum - target;

                return (
                  <div
                    className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                      diff === 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div>
                      <span className="font-semibold">Total Rincian Kelas:</span>{' '}
                      <strong className="font-mono">{sum.toLocaleString('id-ID')} porsi</strong>
                    </div>
                    <div>
                      {diff === 0 ? (
                        <span className="font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Sesuai dengan target hari ini
                        </span>
                      ) : (
                        <span className="font-bold">
                          Selisih: {diff > 0 ? `+${diff}` : diff} porsi vs target ({target})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setEditingSchoolForClass(null)}
                className={`${BTN_SECONDARY} border-transparent bg-transparent hover:bg-slate-100`}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveClassBreakdown}
                className={BTN_PRIMARY}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CETAK 3 LEMBAR DOKUMEN RESMI (PREVIEW & PRINT)                   */}
      {/* ========================================================================= */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delivery-print-title"
            className="bg-white rounded-xl border border-slate-200 w-full max-w-5xl h-[94vh] flex flex-col overflow-hidden"
          >
            {/* Modal Header Controls (Non-Printable) */}
            <style>{`
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 8mm 10mm 10mm 10mm;
                }
                body * {
                  visibility: hidden !important;
                }
                #delivery-printable-area, #delivery-printable-area * {
                  visibility: visible !important;
                }
                #delivery-printable-area {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: white !important;
                }
                .print-page-break {
                  page-break-after: always !important;
                  break-after: page !important;
                  min-height: 265mm;
                  margin-bottom: 0 !important;
                  border: none !important;
                  box-shadow: none !important;
                  padding: 0 !important;
                }
                /* Lembar terakhir tidak memaksa halaman baru agar tidak ada halaman kosong di akhir */
                #delivery-printable-area > div > div:last-child > .print-page-break:last-child {
                  page-break-after: auto !important;
                  break-after: auto !important;
                }
                .no-print {
                  display: none !important;
                }
              }
            `}</style>
            <div className="no-print border-b border-slate-200 shrink-0">
              <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 id="delivery-print-title" className="text-sm font-semibold text-slate-900">
                    Cetak dokumen pengiriman
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {formatIndonesianDate(selectedDate)}
                    {currentOrder && dayOrders.length > 1 ? ` · ${currentOrder.mealSession}` : ''} · {printSchoolsQueue.length} sekolah ·{' '}
                    <span className="font-semibold text-slate-800">{printPageCount} halaman A4</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleTriggerPrint}
                    // Tunggu QR siap agar tidak tercetak tanpa QR
                    disabled={printSchoolsQueue.length === 0 || (wantsHedonicQr && hedonicState === 'loading')}
                    className={BTN_PRIMARY}
                  >
                    <Printer className="w-4 h-4" />
                    Cetak / Simpan PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrintModalOpen(false)}
                    aria-label="Tutup pratinjau"
                    className={`p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer ${FOCUS_RING}`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Pilih lembar yang dicetak */}
              <div className="px-4 sm:px-5 pb-3 flex flex-wrap items-center gap-2">
                <div role="tablist" aria-label="Lembar yang dicetak" className="inline-flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                  {(isCompactDoc
                    ? ([
                        ['ALL', 'Semua lembar'],
                        ['SHEET_1', '1 · Surat jalan & berita acara'],
                        ['SHEET_3', '2 · Uji hedonik kertas'],
                      ] as const)
                    : ([
                        ['ALL', 'Semua lembar'],
                        ['SHEET_1', '1 · Surat jalan'],
                        ['SHEET_2', '2 · Berita acara'],
                        ['SHEET_3', '3 · Uji hedonik'],
                      ] as const)
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={printSheetTab === id}
                      onClick={() => setPrintSheetTab(id)}
                      className={`px-3 rounded-md whitespace-nowrap cursor-pointer min-h-[44px] sm:min-h-[30px] ${FOCUS_RING} ${
                        printSheetTab === id
                          ? 'bg-white text-slate-900 font-semibold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 font-medium'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div role="radiogroup" aria-label="Format dokumen" className="inline-flex gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                  {([
                    ['STANDARD', 'Format standar'],
                    ['LEGACY', 'Format lama'],
                    ['RINGKAS', 'Format ringkas'],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={docFormat === id}
                      onClick={() => changeDocFormat(id)}
                      className={`px-3 rounded-md whitespace-nowrap cursor-pointer min-h-[44px] sm:min-h-[30px] ${FOCUS_RING} ${
                        docFormat === id ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {isCompactDoc && (
                  <label className="inline-flex items-center gap-2 text-xs text-slate-800 cursor-pointer min-h-[44px] sm:min-h-0">
                    <input
                      type="checkbox"
                      checked={hedonicQr}
                      onChange={e => changeHedonicQr(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-700 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-600"
                    />
                    Uji hedonik lewat QR
                  </label>
                )}
                <span className="text-[11px] text-slate-600">
                  {printSheetTab !== 'ALL'
                    ? '1 lembar per sekolah.'
                    : isCompactDoc && wantsHedonicQr
                      ? `1 halaman per sekolah. Sekolah memindai QR untuk uji hedonik, dibuka sampai H+${HEDONIC_DAYS_OPEN}.`
                      : isCompactDoc
                        ? '2 halaman per sekolah. Cetak bolak-balik agar cukup 1 kertas per sekolah.'
                        : '3 lembar per sekolah, masing-masing di halaman baru.'}
                </span>
              </div>
              {wantsHedonicQr && hedonicState !== 'ready' && (
                <p
                  role="status"
                  className={`mx-4 sm:mx-5 mb-3 text-[11px] ${hedonicState === 'error' ? 'p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900' : 'text-slate-600'}`}
                >
                  {hedonicState === 'error'
                    ? 'QR uji hedonik gagal dibuat (periksa internet, atau migrasi hedonic_qr belum dijalankan di Supabase). Lembar uji hedonik kertas ikut dicetak.'
                    : 'Menyiapkan QR uji hedonik…'}
                </p>
              )}
              {isCompactDoc && hedonicQr && !currentOrder && (
                <p className="mx-4 sm:mx-5 mb-3 text-[11px] text-slate-600">QR uji hedonik dibuat dari menu; tanggal ini belum punya menu, jadi lembar kertas yang dicetak.</p>
              )}

              {(printMismatches.length > 0 || missingOfficerFields.length > 0 || !currentOrder) && (
                <div role="note" className="mx-4 sm:mx-5 mb-3 p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-[11px] text-amber-900 space-y-0.5">
                  {!currentOrder && <div>Belum ada menu untuk tanggal ini, kolom menu akan tercetak kosong.</div>}
                  {missingOfficerFields.length > 0 && (
                    <div>Data petugas belum lengkap ({missingOfficerFields.join(', ')}), bagian itu tercetak kosong untuk diisi tangan.</div>
                  )}
                  {printMismatches.map(m => (
                    <div key={m.school.id}>
                      <b>{m.school.schoolName}</b>: rincian kelas {m.classTotal.toLocaleString('id-ID')} porsi, porsi hari ini{' '}
                      {m.dailyP.toLocaleString('id-ID')}. Perbaiki lewat tombol Atur kelas agar porsi per kelas di surat jalan benar.
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Printable Document Viewport */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/70" id="delivery-printable-area">
              <div className="max-w-[210mm] mx-auto space-y-6">
                {printSchoolsQueue.map((school, sIdx) => {
                  const dailyP = (school as any).dailyPortion || school.portionCount;
                  // Nomor: urut sekolah/BAST/SPPG/tanggal/bulan romawi/tahun, mis. 05/BAST/SPPG/28/IX/2026
                  const [yy, mm, dd] = selectedDate.split('-');
                  const docNo = `${docSeqBySchool[school.id] || String(sIdx + 1).padStart(2, '0')}${sessionCode}/BAST/SPPG/${dd}/${getRomanMonth(Number(mm))}/${yy}`;

                  return (
                    <div key={school.id} className="space-y-6">
                      {/* ========================================================= */}
                      {/* LEMBAR 1: SURAT JALAN & DETAIL KELAS                      */}
                      {/* ========================================================= */}
                      {(() => {
                        const sheetProps = {
                          school,
                          dayName: dayNameOf(selectedDate),
                          shortDate: shortDocDate(selectedDate),
                          longDate: formatIndonesianDate(selectedDate),
                          totalPortions: dailyP,
                          officers: officerSettings,
                          kop: <DeliveryKop />,
                        };
                        const isStd = docFormat === 'STANDARD';
                        const classes = printClassRows(school, dailyP);
                        if (isCompactDoc) {
                          const token = hedonicTokenFor(school.id);
                          const pages = token ? 1 : 2;
                          return (
                            <>
                              {(printSheetTab === 'ALL' || printSheetTab === 'SHEET_1') && (
                                <SuratJalanBastSheetCompact
                                  {...sheetProps}
                                  footer={`Halaman 1 dari ${pages} · ${school.schoolName}`}
                                  docNo={docNo}
                                  deliveryTime={school.deliveryTime}
                                  classes={classes}
                                  hedonic={token ? { url: hedonicUrl(token), token, daysOpen: HEDONIC_DAYS_OPEN } : undefined}
                                />
                              )}
                              {((printSheetTab === 'ALL' && !token) || printSheetTab === 'SHEET_3') && (
                                <UjiHedonikSheetStandard {...sheetProps} footer={`Halaman 2 dari 2 · ${school.schoolName}`} />
                              )}
                            </>
                          );
                        }
                        return (
                          <>
                            {(printSheetTab === 'ALL' || printSheetTab === 'SHEET_1') &&
                              (isStd ? (
                                <SuratJalanSheetStandard {...sheetProps} footer={`Lembar 1 dari 3 · ${school.schoolName}`} docNo={docNo} deliveryTime={school.deliveryTime} classes={classes} />
                              ) : (
                                <SuratJalanSheetLegacy {...sheetProps} footer={`Lembar 1 dari 3 · ${school.schoolName}`} docNo={docNo} deliveryTime={school.deliveryTime} classes={classes} />
                              ))}
                            {(printSheetTab === 'ALL' || printSheetTab === 'SHEET_2') &&
                              (isStd ? (
                                <BeritaAcaraSheetStandard {...sheetProps} footer={`Lembar 2 dari 3 · ${school.schoolName}`} docNo={docNo} />
                              ) : (
                                <BeritaAcaraSheetLegacy {...sheetProps} footer={`Lembar 2 dari 3 · ${school.schoolName}`} />
                              ))}
                            {(printSheetTab === 'ALL' || printSheetTab === 'SHEET_3') &&
                              (isStd ? (
                                <UjiHedonikSheetStandard {...sheetProps} footer={`Lembar 3 dari 3 · ${school.schoolName}`} />
                              ) : (
                                <UjiHedonikSheetLegacy {...sheetProps} footer={`Lembar 3 dari 3 · ${school.schoolName}`} />
                              ))}
                          </>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
