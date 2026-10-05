import React, { useState, useMemo, useEffect } from 'react';
import {
  Truck,
  Printer,
  FileText,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  UtensilsCrossed,
  Clock,
  Phone,
  User,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  X,
  ShieldCheck,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Star,
  Layers,
  Sparkles
} from 'lucide-react';
import { MenuOrder, SchoolBeneficiaryAllocation } from '../types/warehouse';
import logoSppgImg from '../assets/logo sppg.png';

export interface ClassBreakdownItem {
  id: string;
  className: string;
  portions: number;
  notes?: string;
}

export interface DeliveryOfficerSettings {
  nutritionistName: string;
  nutritionistTitle: string;
  fieldAssistantName: string;
  vehicleNumber: string;
  pickupTimeRange: string;
}

const DEFAULT_OFFICERS: DeliveryOfficerSettings = {
  nutritionistName: 'Rizky Firmansyah, S.Gz',
  nutritionistTitle: 'Pemeriksa Ahli Gizi SPPG',
  fieldAssistantName: 'Ahmad Fauzi',
  vehicleNumber: 'N 1845 AB (Mobil Operasional SPPG)',
  pickupTimeRange: '12:30 - 13:30 WIB'
};

const STORAGE_KEY_CLASSES = 'sppg_delivery_class_breakdowns_v2';
const STORAGE_KEY_OFFICERS = 'sppg_delivery_officers_v2';

export function getDefaultClassesForSchool(
  category: string,
  totalPortions: number
): ClassBreakdownItem[] {
  let baseNames: string[] = [];

  if (category === 'SMP / MTs') {
    baseNames = ['Kelas 7A', 'Kelas 7B', 'Kelas 8A', 'Kelas 8B', 'Kelas 9A', 'Kelas 9B', 'Guru & Tenaga Pendidik'];
  } else if (category === 'PAUD / TK') {
    baseNames = ['Kelompok Bermain (KB)', 'TK A', 'TK B', 'Guru Pembimbing'];
  } else if (category === 'Ibu Hamil & Balita (B3)') {
    baseNames = ['Balita 0 - 23 Bulan', 'Balita 24 - 59 Bulan', 'Ibu Hamil (Bumil)', 'Kader Posyandu'];
  } else {
    // Default SD / MI
    baseNames = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6', 'Guru & Tenaga Pendidik'];
  }

  const numUnits = baseNames.length;
  if (numUnits === 0) return [];

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

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  try {
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[2], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      return `${day} ${months[monthIdx]} ${parts[0]}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
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
  const [selectedDate, setSelectedDate] = useState<string>(currentDate);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Petugas Pengiriman
  const [officerSettings, setOfficerSettings] = useState<DeliveryOfficerSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_OFFICERS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_OFFICERS;
  });
  const [isOfficerModalOpen, setIsOfficerModalOpen] = useState(false);

  // Kustomisasi Rincian Kelas per sekolah (Key: schoolId_date atau schoolId)
  const [customClassBreakdowns, setCustomClassBreakdowns] = useState<Record<string, ClassBreakdownItem[]>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLASSES);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {};
  });

  // Modal Atur Kelas
  const [editingSchoolForClass, setEditingSchoolForClass] = useState<SchoolBeneficiaryAllocation | null>(null);
  const [tempClassItems, setTempClassItems] = useState<ClassBreakdownItem[]>([]);

  // Modal Cetak 3 Lembar (Single School or Batch All)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printSchoolsQueue, setPrintSchoolsQueue] = useState<SchoolBeneficiaryAllocation[]>([]);
  const [printSheetTab, setPrintSheetTab] = useState<'ALL' | 'SHEET_1' | 'SHEET_2' | 'SHEET_3'>('ALL');

  // Sync date from parent
  useEffect(() => {
    if (currentDate && currentDate !== selectedDate) {
      setSelectedDate(currentDate);
    }
  }, [currentDate]);

  // Order pada tanggal terpilih
  const currentOrder = useMemo(() => {
    return orders.find(o => o.date === selectedDate);
  }, [orders, selectedDate]);

  // Daftar tanggal order menu yang tersedia
  const distinctOrderDates = useMemo(() => {
    return Array.from(new Set(orders.map(o => o.date))).sort();
  }, [orders]);

  // Alokasi porsi tiap sekolah pada tanggal terpilih
  const schoolAllocationsForDate = useMemo(() => {
    return masterSchools.map(school => {
      let portion = school.portionCount;
      if (currentOrder?.beneficiaryAllocations) {
        const found = currentOrder.beneficiaryAllocations.find(b => b.id === school.id);
        if (found && typeof found.portionCount === 'number') {
          portion = found.portionCount;
        }
      }
      return {
        ...school,
        dailyPortion: portion
      };
    });
  }, [masterSchools, currentOrder]);

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
  const getSchoolClassBreakdown = (schoolId: string, category: string, totalPortion: number): ClassBreakdownItem[] => {
    const keyWithDate = `${schoolId}_${selectedDate}`;
    if (customClassBreakdowns[keyWithDate]) {
      return customClassBreakdowns[keyWithDate];
    }
    if (customClassBreakdowns[schoolId]) {
      return customClassBreakdowns[schoolId];
    }
    return getDefaultClassesForSchool(category, totalPortion);
  };

  // Buka editor kelas
  const handleOpenClassEditor = (school: SchoolBeneficiaryAllocation & { dailyPortion: number }) => {
    setEditingSchoolForClass(school);
    const existing = getSchoolClassBreakdown(school.id, school.category, school.dailyPortion);
    setTempClassItems(JSON.parse(JSON.stringify(existing)));
  };

  // Simpan hasil edit kelas
  const handleSaveClassBreakdown = () => {
    if (!editingSchoolForClass) return;
    const key = `${editingSchoolForClass.id}_${selectedDate}`;
    const nextMap = {
      ...customClassBreakdowns,
      [key]: tempClassItems
    };
    setCustomClassBreakdowns(nextMap);
    try {
      localStorage.setItem(STORAGE_KEY_CLASSES, JSON.stringify(nextMap));
    } catch {
      // ignore
    }
    setEditingSchoolForClass(null);
  };

  // Reset kelas ke default proporsional
  const handleResetClassToDefault = () => {
    if (!editingSchoolForClass) return;
    const dailyP = (editingSchoolForClass as any).dailyPortion || editingSchoolForClass.portionCount;
    const def = getDefaultClassesForSchool(editingSchoolForClass.category, dailyP);
    setTempClassItems(def);
  };

  // Buka modal cetak untuk 1 sekolah
  const handlePrintSingleSchool = (school: SchoolBeneficiaryAllocation) => {
    setPrintSchoolsQueue([school]);
    setPrintSheetTab('ALL');
    setIsPrintModalOpen(true);
  };

  // Buka modal cetak untuk seluruh sekolah aktif
  const handlePrintAllSchools = () => {
    if (filteredSchools.length === 0) return;
    setPrintSchoolsQueue(filteredSchools);
    setPrintSheetTab('ALL');
    setIsPrintModalOpen(true);
  };

  // Simpan pengaturan petugas
  const handleSaveOfficers = () => {
    try {
      localStorage.setItem(STORAGE_KEY_OFFICERS, JSON.stringify(officerSettings));
    } catch {
      // ignore
    }
    setIsOfficerModalOpen(false);
  };

  // Pemicu cetak langsung
  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* 1. Bar Navigasi Tanggal & Ringkasan Menu */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Tanggal Distribusi:</span>
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - 1);
                  const nextIso = d.toISOString().slice(0, 10);
                  setSelectedDate(nextIso);
                  if (onSelectDate) onSelectDate(nextIso);
                }}
                className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="H-1"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <input
                type="date"
                value={selectedDate}
                onChange={e => {
                  setSelectedDate(e.target.value);
                  if (onSelectDate) onSelectDate(e.target.value);
                }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 bg-white font-mono"
              />

              <button
                type="button"
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() + 1);
                  const nextIso = d.toISOString().slice(0, 10);
                  setSelectedDate(nextIso);
                  if (onSelectDate) onSelectDate(nextIso);
                }}
                className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="H+1"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick jump to dates with orders */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400">Pilih Jadwal Menu:</span>
              <select
                value={distinctOrderDates.includes(selectedDate) ? selectedDate : ''}
                onChange={e => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                    if (onSelectDate) onSelectDate(e.target.value);
                  }
                }}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-800 bg-white font-medium"
              >
                <option value="">-- Pilih Tanggal Tersedia --</option>
                {distinctOrderDates.map(d => (
                  <option key={d} value={d}>
                    {formatShortDate(d)} - {orders.find(o => o.date === d)?.menuTitle.slice(0, 32)}...
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Header: Petugas & Cetak Semua */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsOfficerModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Atur Nama Pemeriksa Ahli, Asisten Lapangan & No. Kendaraan"
            >
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Pengaturan Petugas</span>
            </button>

            <button
              type="button"
              onClick={handlePrintAllSchools}
              disabled={filteredSchools.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              title="Cetak Surat Jalan & Berita Acara untuk seluruh sekolah terpilih (3 lembar per sekolah)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Semua Sekolah (3 Lembar)</span>
            </button>
          </div>
        </div>

        {/* Day & Menu Banner */}
        <div className="p-3.5 rounded-xl bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white">
                {formatIndonesianDate(selectedDate)}
              </span>
              {currentOrder ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Order Menu #{currentOrder.id} • Sesi {currentOrder.mealSession}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Belum ada menu order resmi terdaftar pada tanggal ini
                </span>
              )}
            </div>
            <div className="text-xs text-slate-300 flex items-center gap-1.5">
              <UtensilsCrossed className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{currentOrder?.menuTitle || 'Menu Reguler Gizi Seimbang SPPG Jeru Tumpang'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="text-[11px] text-slate-400">Total Alokasi Hari Ini:</div>
              <div className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                {totalPortionsForDay.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-300">porsi</span>
              </div>
            </div>
            <div className="text-right border-l border-slate-700 pl-4">
              <div className="text-[11px] text-slate-400">Titik Penerima:</div>
              <div className="text-lg font-bold font-mono text-indigo-300 tabular-nums">
                {schoolAllocationsForDate.length} <span className="text-xs font-normal text-slate-300">sekolah</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg text-slate-800 bg-white"
            >
              <option value="ALL">Semua Kategori ({schoolAllocationsForDate.length} Titik)</option>
              <option value="SD / MI">Sekolah Dasar (SD / MI)</option>
              <option value="SMP / MTs">Sekolah Menengah (SMP / MTs)</option>
              <option value="PAUD / TK">PAUD / TK</option>
              <option value="Ibu Hamil & Balita (B3)">Balita 3T & Ibu Hamil</option>
            </select>

            <span className="text-xs text-slate-400">
              Menampilkan <strong>{filteredSchools.length}</strong> lembaga
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama sekolah, PIC, kontak..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 w-64 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* 2. Daftar Sekolah & Status Dokumen Pengiriman */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="py-2.5 px-3 w-10 text-center">No</th>
                <th className="py-2.5 px-4 min-w-[200px]">Nama Sekolah / Lembaga</th>
                <th className="py-2.5 px-3 w-28">Kategori</th>
                <th className="py-2.5 px-3 w-32 text-right">Porsi Hari Ini</th>
                <th className="py-2.5 px-3 w-28">Jadwal Kirim</th>
                <th className="py-2.5 px-4 w-44">PIC & Kontak</th>
                <th className="py-2.5 px-3 min-w-[170px]">Rincian Kelas</th>
                <th className="py-2.5 px-3 w-48 text-center">Aksi Dokumen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSchools.map((s, idx) => {
                const breakdown = getSchoolClassBreakdown(s.id, s.category, s.dailyPortion);
                const classCount = breakdown.length;
                const hasCustom = Boolean(
                  customClassBreakdowns[`${s.id}_${selectedDate}`] || customClassBreakdowns[s.id]
                );

                return (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{s.schoolName}</div>
                      {s.notes && (
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">{s.notes}</div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                        {s.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="font-mono font-bold text-emerald-800 text-sm tabular-nums">
                        {s.dailyPortion.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-1">porsi</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{s.deliveryTime || '10:00 - 10:30'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 text-[11px]">
                      <div className="font-semibold text-slate-900">{s.contactPerson || '-'}</div>
                      <div className="text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                        <Phone className="w-2.5 h-2.5 text-slate-400" />
                        <span>{s.phone || '-'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-[11px]">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-slate-600 font-medium">
                          {classCount} Rombel / Kelas
                        </span>
                        {hasCustom && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Kustom
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenClassEditor(s)}
                        className="text-[10px] text-indigo-700 hover:text-indigo-900 font-semibold hover:underline mt-0.5 cursor-pointer block text-left"
                      >
                        Atur Rincian Kelas
                      </button>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handlePrintSingleSchool(s)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                        title="Lihat Pratinjau & Cetak 3 Lembar Dokumen"
                      >
                        <Printer className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Cetak 3 Lembar</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-bold text-slate-900">
                <td colSpan={3} className="py-3 px-4 text-right text-xs">
                  Total Alokasi Seluruh Sekolah:
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800 text-sm tabular-nums">
                  {totalPortionsForDay.toLocaleString('id-ID')} <span className="text-xs font-normal">porsi</span>
                </td>
                <td colSpan={4} className="py-3 px-4 text-xs text-slate-500 font-normal">
                  Setiap sekolah tercetak 3 lembar: 1) Surat Jalan Rincian Kelas, 2) Berita Acara Alat, 3) Form Uji Organoleptik
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: PENGATURAN PETUGAS DISTRIBUSI & KENDARAAN                        */}
      {/* ========================================================================= */}
      {isOfficerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Pengaturan Petugas Pengiriman</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOfficerModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pemeriksa Ahli SPPG (Ahli Gizi / QA)
                </label>
                <input
                  type="text"
                  value={officerSettings.nutritionistName}
                  onChange={e => setOfficerSettings(prev => ({ ...prev, nutritionistName: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Nama Lengkap & Gelar Ahli Gizi..."
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Jabatan / Unit
                </label>
                <input
                  type="text"
                  value={officerSettings.nutritionistTitle}
                  onChange={e => setOfficerSettings(prev => ({ ...prev, nutritionistTitle: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Jabatan..."
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Asisten Lapangan (Driver / Petugas Distribusi)
                </label>
                <input
                  type="text"
                  value={officerSettings.fieldAssistantName}
                  onChange={e => setOfficerSettings(prev => ({ ...prev, fieldAssistantName: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Nama Petugas Lapangan..."
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Identitas Kendaraan Operasional
                </label>
                <input
                  type="text"
                  value={officerSettings.vehicleNumber}
                  onChange={e => setOfficerSettings(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Nomor Polisi / Jenis Kendaraan..."
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Estimasi Jadwal Penjemputan Alat Kembali
                </label>
                <input
                  type="text"
                  value={officerSettings.pickupTimeRange}
                  onChange={e => setOfficerSettings(prev => ({ ...prev, pickupTimeRange: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="12:30 - 13:30 WIB"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsOfficerModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveOfficers}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                Simpan Petugas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ATUR RINCIAN KELAS / SASARAN PER SEKOLAH                        */}
      {/* ========================================================================= */}
      {editingSchoolForClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
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
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
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
                    <RotateCcw className="w-3 h-3 text-slate-400" />
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
                    <span className="text-slate-400 font-mono w-5 text-center">{idx + 1}</span>
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
                      <span className="text-slate-400 text-[11px]">porsi</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTempClassItems(prev => prev.filter((_, i) => i !== idx));
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
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
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveClassBreakdown}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                Simpan Rincian Kelas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CETAK 3 LEMBAR DOKUMEN RESMI (PREVIEW & PRINT)                   */}
      {/* ========================================================================= */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
                .no-print {
                  display: none !important;
                }
              }
            `}</style>
            <div className="no-print p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Pratinjau Cetak Dokumen Pengiriman SPPG
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mencetak <strong>{printSchoolsQueue.length}</strong> sekolah • 3 lembar resmi per sekolah (Format Kertas A4)
                  </p>
                </div>
              </div>

              {/* Sheet Switcher */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPrintSheetTab('ALL')}
                  className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                    printSheetTab === 'ALL'
                      ? 'bg-slate-900 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua Lembar (3 Hal)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintSheetTab('SHEET_1')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    printSheetTab === 'SHEET_1'
                      ? 'bg-indigo-700 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Lembar 1: Surat Jalan
                </button>
                <button
                  type="button"
                  onClick={() => setPrintSheetTab('SHEET_2')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    printSheetTab === 'SHEET_2'
                      ? 'bg-indigo-700 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Lembar 2: Berita Acara Alat
                </button>
                <button
                  type="button"
                  onClick={() => setPrintSheetTab('SHEET_3')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    printSheetTab === 'SHEET_3'
                      ? 'bg-indigo-700 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Lembar 3: Uji Organoleptik
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTriggerPrint}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / Simpan PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Viewport */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/70" id="delivery-printable-area">
              <div className="max-w-[210mm] mx-auto space-y-6">
                {printSchoolsQueue.map((school, sIdx) => {
                  const dailyP = (school as any).dailyPortion || school.portionCount;
                  const classes = getSchoolClassBreakdown(school.id, school.category, dailyP);
                  const totalClassPortion = classes.reduce((sum, c) => sum + (Number(c.portions) || 0), 0);
                  const dateCode = selectedDate.replace(/-/g, '');
                  const docNumSuffix = String(sIdx + 1).padStart(2, '0');

                  return (
                    <div key={school.id} className="space-y-6">
                      {/* ========================================================= */}
                      {/* LEMBAR 1: SURAT JALAN & DETAIL KELAS                      */}
                      {/* ========================================================= */}
                      {(printSheetTab === 'ALL' || printSheetTab === 'SHEET_1') && (
                        <div className="bg-white p-7 shadow-md rounded-sm border border-slate-300 print:border-none print:shadow-none print:p-0 print-page-break text-slate-900 font-sans text-xs">
                          {/* Kop Surat */}
                          <div className="flex items-center gap-3.5 pb-2 border-b-2 border-black">
                            <img
                              src={logoSppgImg}
                              alt="Logo SPPG"
                              className="w-14 h-14 object-contain shrink-0"
                            />
                            <div className="flex-1 text-center pr-10">
                              <div className="text-[11px] font-bold text-slate-900 tracking-normal leading-tight">
                                BADAN GIZI NASIONAL
                              </div>
                              <h1 className="text-sm font-bold text-slate-950 tracking-normal leading-tight">
                                SATUAN PELAYANAN PEMENUHAN GIZI (SPPG) JERU TUMPANG
                              </h1>
                              <p className="text-[9.5px] text-slate-700 leading-tight mt-0.5">
                                Jl. Raya Jeru No. 136, RT.01/RW.02, Kec. Tumpang, Kab. Malang, Jawa Timur 65156
                              </p>
                              <p className="text-[9.5px] text-slate-700 leading-tight">
                                Email: sppg.jeru.tumpang@bgn.go.id • Hotline / WA: 0812-3456-7890
                              </p>
                            </div>
                          </div>

                          {/* Judul Dokumen */}
                          <div className="text-center my-3">
                            <h2 className="text-sm font-bold text-slate-950 tracking-normal">
                              Surat Jalan Pengiriman Makanan Bergizi
                            </h2>
                            <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                              No. Surat Jalan: <span className="font-bold text-slate-900">SJ/SPPG-JT/{dateCode}/{docNumSuffix}</span>
                            </div>
                          </div>

                          {/* Metadata Grid */}
                          <div className="grid grid-cols-2 gap-4 p-2.5 bg-slate-50 border border-slate-300 rounded mb-3 text-[11px]">
                            <div className="space-y-1">
                              <div className="flex">
                                <span className="w-28 font-semibold text-slate-600">Penerima Manfaat</span>
                                <span className="w-2">:</span>
                                <span className="font-bold text-slate-900">{school.schoolName}</span>
                              </div>
                              <div className="flex">
                                <span className="w-28 font-semibold text-slate-600">Kategori Sasaran</span>
                                <span className="w-2">:</span>
                                <span className="text-slate-800">{school.category}</span>
                              </div>
                              <div className="flex">
                                <span className="w-28 font-semibold text-slate-600">PIC / Kontak</span>
                                <span className="w-2">:</span>
                                <span className="text-slate-800">{school.contactPerson || '-'} ({school.phone || '-'})</span>
                              </div>
                              <div className="flex">
                                <span className="w-28 font-semibold text-slate-600">Catatan Lokasi</span>
                                <span className="w-2">:</span>
                                <span className="text-slate-700 truncate">{school.notes || 'Wilayah Tumpang Jeru'}</span>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex">
                                <span className="w-28 font-semibold text-slate-600">Hari & Tanggal</span>
                                <span className="w-2">:</span>
                                <span className="font-semibold text-slate-900">{formatIndonesianDate(selectedDate)}</span>
                              </div>
                              <div className="flex">
                                <span className="w-28 font-semibold text-slate-600">Waktu Kirim</span>
                                <span className="w-2">:</span>
                                <span className="font-mono text-slate-800">{school.deliveryTime || '10:00 - 10:30'} WIB</span>
                              </div>
                              <div className="flex">
                                <span className="w-28 font-semibold text-slate-600">Petugas Driver</span>
                                <span className="w-2">:</span>
                                <span className="text-slate-800">{officerSettings.fieldAssistantName}</span>
                              </div>
                              <div className="flex">
                                <span className="w-28 font-semibold text-slate-600">Armada / Nopol</span>
                                <span className="w-2">:</span>
                                <span className="font-mono text-slate-800">{officerSettings.vehicleNumber}</span>
                              </div>
                            </div>
                          </div>

                          {/* Menu Masakan Hari Ini */}
                          <div className="p-2 border border-slate-300 rounded mb-3 bg-white text-[11px]">
                            <div className="flex items-start">
                              <span className="w-28 font-semibold text-slate-700 shrink-0">Menu Masakan Hari Ini:</span>
                              <span className="font-bold text-slate-900 leading-snug">
                                {currentOrder?.menuTitle || 'Nasi Putih, Lauk Protein Bergizi, Sayur Mayur Segar, Buah Musim'}
                              </span>
                            </div>
                          </div>

                          {/* Tabel Detail Rincian Kelas & Jumlah Siswa */}
                          <div className="mb-3">
                            <div className="text-[11px] font-bold text-slate-800 mb-1">
                              Rincian Distribusi per Kelas / Kelompok Sasaran:
                            </div>
                            <table className="w-full text-left text-[11px] border-collapse border border-slate-800">
                              <thead>
                                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                                  <th className="py-1.5 px-2 border border-slate-800 w-8 text-center">No</th>
                                  <th className="py-1.5 px-3 border border-slate-800">Nama Kelas / Rombel</th>
                                  <th className="py-1.5 px-3 border border-slate-800 w-32 text-right">Jumlah Penerima</th>
                                  <th className="py-1.5 px-3 border border-slate-800 w-28 text-center">Wadah / Tray</th>
                                  <th className="py-1.5 px-3 border border-slate-800">Keterangan Khusus</th>
                                </tr>
                              </thead>
                              <tbody>
                                {classes.map((cls, cIdx) => (
                                  <tr key={cls.id || cIdx} className="border-b border-slate-300">
                                    <td className="py-1.5 px-2 border border-slate-800 text-center font-mono text-[10px]">{cIdx + 1}</td>
                                    <td className="py-1.5 px-3 border border-slate-800 font-semibold">{cls.className}</td>
                                    <td className="py-1.5 px-3 border border-slate-800 text-right font-mono font-bold tabular-nums">
                                      {cls.portions.toLocaleString('id-ID')} <span className="font-normal text-[10px]">porsi</span>
                                    </td>
                                    <td className="py-1.5 px-3 border border-slate-800 text-center font-mono">
                                      {cls.portions} Tray
                                    </td>
                                    <td className="py-1.5 px-3 border border-slate-800 text-[10.5px] text-slate-600">
                                      {cls.notes || 'Porsi Reguler'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-slate-100 font-bold border-t-2 border-slate-800">
                                  <td colSpan={2} className="py-2 px-3 border border-slate-800 text-right">
                                    Total Porsi yang Diserahkan:
                                  </td>
                                  <td className="py-2 px-3 border border-slate-800 text-right font-mono font-bold text-sm text-slate-900 tabular-nums">
                                    {totalClassPortion.toLocaleString('id-ID')} <span className="text-xs font-normal">porsi</span>
                                  </td>
                                  <td className="py-2 px-3 border border-slate-800 text-center font-mono font-bold">
                                    {totalClassPortion} Tray
                                  </td>
                                  <td className="py-2 px-3 border border-slate-800 text-[10px] text-slate-600 font-normal">
                                    Lengkap & Disertai Peralatan
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>

                          {/* Catatan Standar */}
                          <div className="p-2 border border-dashed border-slate-400 rounded text-[9.5px] text-slate-600 space-y-0.5 mb-4">
                            <div>• Makanan telah melalui pengecekan suhu & higienitas dapur SPPG Jeru Tumpang sebelum dikirim.</div>
                            <div>• Dianjurkan makanan segera dikonsumsi maksimal dalam waktu 2 jam setelah diterima di sekolah.</div>
                            <div>• Segala bentuk masukan atau komplain rasa/porsi dapat dicantumkan pada Lembar 3 (Form Uji Organoleptik).</div>
                          </div>

                          {/* Tanda Tangan 3 Pihak Sesuai Request */}
                          <div className="pt-2">
                            <div className="text-[10px] font-semibold text-slate-700 text-center mb-2">
                              Lembar Pengesahan Serah Terima Distribusi Makanan Bergizi:
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center text-[10.5px]">
                              {/* 1. Pemeriksa Ahli SPPG */}
                              <div className="p-2 flex flex-col justify-between min-h-[90px]">
                                <div>
                                  <div className="font-semibold text-slate-600">Pemeriksa Ahli SPPG</div>
                                  <div className="text-[9.5px] text-slate-500">Ahli Gizi & Mutu</div>
                                </div>
                                <div className="mt-10 border-t border-slate-800 pt-1">
                                  <div className="font-bold text-slate-900 underline">
                                    {officerSettings.nutritionistName}
                                  </div>
                                  <div className="text-[9.5px] text-slate-500">{officerSettings.nutritionistTitle}</div>
                                </div>
                              </div>

                              {/* 2. Asisten Lapangan */}
                              <div className="p-2 flex flex-col justify-between min-h-[90px]">
                                <div>
                                  <div className="font-semibold text-slate-600">Asisten Lapangan</div>
                                  <div className="text-[9.5px] text-slate-500">Petugas Distribusi / Driver</div>
                                </div>
                                <div className="mt-10 border-t border-slate-800 pt-1">
                                  <div className="font-bold text-slate-900 underline">
                                    {officerSettings.fieldAssistantName}
                                  </div>
                                  <div className="text-[9.5px] text-slate-500">SPPG Jeru Tumpang</div>
                                </div>
                              </div>

                              {/* 3. Diterima PIC Sekolah */}
                              <div className="p-2 flex flex-col justify-between min-h-[90px]">
                                <div>
                                  <div className="font-semibold text-slate-600">Diterima oleh PIC Sekolah</div>
                                  <div className="text-[9.5px] text-slate-500">{school.schoolName}</div>
                                </div>
                                <div className="mt-10 border-t border-slate-800 pt-1">
                                  <div className="font-bold text-slate-900 underline">
                                    ( {school.contactPerson || '...........................................'} )
                                  </div>
                                  <div className="text-[9.5px] text-slate-500">Kepala Sekolah / Guru Penerima</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="text-right text-[8.5px] text-slate-400 mt-2 font-mono">
                            Lembar 1 dari 3 • Dokumen Resmi SPPG Jeru Tumpang
                          </div>
                        </div>
                      )}

                      {/* ========================================================= */}
                      {/* LEMBAR 2: BERITA ACARA PENYERAHAN ALAT                    */}
                      {/* ========================================================= */}
                      {(printSheetTab === 'ALL' || printSheetTab === 'SHEET_2') && (
                        <div className="bg-white p-7 shadow-md rounded-sm border border-slate-300 print:border-none print:shadow-none print:p-0 print-page-break text-slate-900 font-sans text-xs">
                          {/* Kop Surat */}
                          <div className="flex items-center gap-3.5 pb-2 border-b-2 border-black">
                            <img
                              src={logoSppgImg}
                              alt="Logo SPPG"
                              className="w-14 h-14 object-contain shrink-0"
                            />
                            <div className="flex-1 text-center pr-10">
                              <div className="text-[11px] font-bold text-slate-900 tracking-normal leading-tight">
                                BADAN GIZI NASIONAL
                              </div>
                              <h1 className="text-sm font-bold text-slate-950 tracking-normal leading-tight">
                                SATUAN PELAYANAN PEMENUHAN GIZI (SPPG) JERU TUMPANG
                              </h1>
                              <p className="text-[9.5px] text-slate-700 leading-tight mt-0.5">
                                Jl. Raya Jeru No. 136, RT.01/RW.02, Kec. Tumpang, Kab. Malang, Jawa Timur 65156
                              </p>
                              <p className="text-[9.5px] text-slate-700 leading-tight">
                                Email: sppg.jeru.tumpang@bgn.go.id • Hotline / WA: 0812-3456-7890
                              </p>
                            </div>
                          </div>

                          {/* Judul Dokumen */}
                          <div className="text-center my-3">
                            <h2 className="text-sm font-bold text-slate-950 tracking-normal">
                              Berita Acara Penyerahan & Peminjaman Peralatan Distribusi
                            </h2>
                            <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                              No. Berita Acara: <span className="font-bold text-slate-900">BA-ALAT/SPPG-JT/{dateCode}/{docNumSuffix}</span>
                            </div>
                          </div>

                          {/* Klausul Pengantar */}
                          <div className="p-2.5 bg-slate-50 border border-slate-300 rounded mb-3 text-[10.5px] leading-relaxed text-slate-700">
                            Pada hari ini <strong className="text-slate-900">{formatIndonesianDate(selectedDate)}</strong>, bertempat di <strong className="text-slate-900">{school.schoolName}</strong>, telah dilakukan serah terima peralatan pendukung makan bergizi antara <strong>Pihak Pertama (SPPG Jeru Tumpang)</strong> kepada <strong>Pihak Kedua ({school.schoolName})</strong> dengan rincian peralatan sebagai berikut:
                          </div>

                          {/* Tabel Peralatan yang Dipinjamkan */}
                          <div className="mb-3">
                            <table className="w-full text-left text-[11px] border-collapse border border-slate-800">
                              <thead>
                                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                                  <th className="py-1.5 px-2 border border-slate-800 w-8 text-center">No</th>
                                  <th className="py-1.5 px-3 border border-slate-800">Nama Peralatan Program</th>
                                  <th className="py-1.5 px-3 border border-slate-800">Spesifikasi Standar</th>
                                  <th className="py-1.5 px-2.5 border border-slate-800 w-24 text-center">Jumlah Diserahkan</th>
                                  <th className="py-1.5 px-2.5 border border-slate-800 w-24 text-center">Kondisi Serah</th>
                                  <th className="py-1.5 px-2.5 border border-slate-800 w-24 text-center">Kondisi Kembali</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono">1</td>
                                  <td className="py-1.5 px-3 border border-slate-800 font-semibold">
                                    Stainless Steel Food Tray 5 Sekat
                                  </td>
                                  <td className="py-1.5 px-3 border border-slate-800 text-[10px] text-slate-600">
                                    SUS 304 Food Grade + Tutup Rapat
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-center font-mono font-bold">
                                    {dailyP} Unit
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-center text-[10px] font-semibold text-emerald-800 bg-emerald-50/50">
                                    Baik & Bersih
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-center text-[10px] text-slate-400">
                                    [  ] Lengkap
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono">2</td>
                                  <td className="py-1.5 px-3 border border-slate-800 font-semibold">
                                    Thermal Box Insulasi Penjaga Suhu
                                  </td>
                                  <td className="py-1.5 px-3 border border-slate-800 text-[10px] text-slate-600">
                                    EPP Foam Heavy Duty Warmer Box
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-center font-mono font-bold">
                                    {Math.max(1, Math.ceil(dailyP / 80))} Unit
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-center text-[10px] font-semibold text-emerald-800 bg-emerald-50/50">
                                    Baik & Bersih
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-center text-[10px] text-slate-400">
                                    [  ] Utuh
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono">3</td>
                                  <td className="py-1.5 px-3 border border-slate-800 font-semibold">
                                    Sendok Makan Stainless Steel
                                  </td>
                                  <td className="py-1.5 px-3 border border-slate-800 text-[10px] text-slate-600">
                                    SUS 304 Tebal, Higienis Terbungkus
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-center font-mono font-bold">
                                    {dailyP} Pcs
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-center text-[10px] font-semibold text-emerald-800 bg-emerald-50/50">
                                    Baik & Bersih
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-center text-[10px] text-slate-400">
                                    [  ] Lengkap
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono">4</td>
                                  <td className="py-1.5 px-3 border border-slate-800 font-semibold">
                                    Container / Keranjang Distribusi
                                  </td>
                                  <td className="py-1.5 px-3 border border-slate-800 text-[10px] text-slate-600">
                                    Box Plastik Industri Penampung Tray
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-center font-mono font-bold">
                                    {Math.max(1, Math.ceil(dailyP / 60))} Unit
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-center text-[10px] font-semibold text-emerald-800 bg-emerald-50/50">
                                    Baik & Bersih
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-center text-[10px] text-slate-400">
                                    [  ] Utuh
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono">5</td>
                                  <td className="py-1.5 px-3 border border-slate-800 font-semibold">
                                    Wadah Sayur Kuah Stainless Berinsulasi
                                  </td>
                                  <td className="py-1.5 px-3 border border-slate-800 text-[10px] text-slate-600">
                                    Thermos Sayur / Panci Seal Stainless
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-center font-mono font-bold">
                                    {school.category === 'SD / MI' || school.category === 'SMP / MTs' ? '1 - 2 Unit' : '-'}
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-center text-[10px] font-semibold text-emerald-800 bg-emerald-50/50">
                                    Sesuai Kebutuhan
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-center text-[10px] text-slate-400">
                                    [  ] Bersih
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Ketentuan Tanggung Jawab & Penjemputan */}
                          <div className="p-3 border border-slate-300 rounded mb-4 bg-slate-50/60 text-[10px] text-slate-700 space-y-1">
                            <div className="font-bold text-slate-900 text-[10.5px] mb-1">
                              Ketentuan Perawatan & Penjemputan Kembali Peralatan:
                            </div>
                            <div>
                              1. Seluruh peralatan adalah aset program Badan Gizi Nasional yang dipinjamkan sementara untuk sesi makan hari ini.
                            </div>
                            <div>
                              2. Pihak sekolah memastikan sisa makanan padat telah dibuang ke kantong sampah sebelum tray ditumpuk ke kontainer.
                            </div>
                            <div>
                              3. Seluruh peralatan akan dijemput kembali oleh Asisten Lapangan SPPG pada pukul <strong>{officerSettings.pickupTimeRange}</strong>.
                            </div>
                            <div>
                              4. Penghitungan ulang jumlah unit dilakukan bersama saat penjemputan oleh Asisten Lapangan dan PIC Sekolah.
                            </div>
                          </div>

                          {/* Tanda Tangan Serah Terima */}
                          <div className="pt-2">
                            <div className="grid grid-cols-3 gap-2 text-center text-[10.5px]">
                              {/* Yang Menyerahkan */}
                              <div className="p-2 flex flex-col justify-between min-h-[90px]">
                                <div>
                                  <div className="font-semibold text-slate-600">Yang Menyerahkan</div>
                                  <div className="text-[9.5px] text-slate-500">Asisten Lapangan SPPG</div>
                                </div>
                                <div className="mt-12 border-t border-slate-800 pt-1">
                                  <div className="font-bold text-slate-900 underline">
                                    {officerSettings.fieldAssistantName}
                                  </div>
                                  <div className="text-[9.5px] text-slate-500">Petugas Distribusi SPPG</div>
                                </div>
                              </div>

                              {/* Yang Menerima */}
                              <div className="p-2 flex flex-col justify-between min-h-[90px]">
                                <div>
                                  <div className="font-semibold text-slate-600">Yang Menerima</div>
                                  <div className="text-[9.5px] text-slate-500">Pihak Sekolah / Lembaga</div>
                                </div>
                                <div className="mt-12 border-t border-slate-800 pt-1">
                                  <div className="font-bold text-slate-900 underline">
                                    ( {school.contactPerson || '...........................................'} )
                                  </div>
                                  <div className="text-[9.5px] text-slate-500">PIC / Penanggung Jawab</div>
                                </div>
                              </div>

                              {/* Mengetahui */}
                              <div className="p-2 flex flex-col justify-between min-h-[90px]">
                                <div>
                                  <div className="font-semibold text-slate-600">Mengetahui</div>
                                  <div className="text-[9.5px] text-slate-500">Penanggung Jawab Distribusi SPPG</div>
                                </div>
                                <div className="mt-12 border-t border-slate-800 pt-1">
                                  <div className="font-bold text-slate-900 underline">
                                    {officerSettings.nutritionistName}
                                  </div>
                                  <div className="text-[9.5px] text-slate-500">{officerSettings.nutritionistTitle}</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="text-right text-[8.5px] text-slate-400 mt-3 font-mono">
                            Lembar 2 dari 3 • Dokumen Resmi SPPG Jeru Tumpang
                          </div>
                        </div>
                      )}

                      {/* ========================================================= */}
                      {/* LEMBAR 3: UJI ORGANOLEPTIK DENGAN SKORING, KRITIK & SARAN */}
                      {/* ========================================================= */}
                      {(printSheetTab === 'ALL' || printSheetTab === 'SHEET_3') && (
                        <div className="bg-white p-7 shadow-md rounded-sm border border-slate-300 print:border-none print:shadow-none print:p-0 print-page-break text-slate-900 font-sans text-xs">
                          {/* Kop Surat */}
                          <div className="flex items-center gap-3.5 pb-2 border-b-2 border-black">
                            <img
                              src={logoSppgImg}
                              alt="Logo SPPG"
                              className="w-14 h-14 object-contain shrink-0"
                            />
                            <div className="flex-1 text-center pr-10">
                              <div className="text-[11px] font-bold text-slate-900 tracking-normal leading-tight">
                                BADAN GIZI NASIONAL
                              </div>
                              <h1 className="text-sm font-bold text-slate-950 tracking-normal leading-tight">
                                SATUAN PELAYANAN PEMENUHAN GIZI (SPPG) JERU TUMPANG
                              </h1>
                              <p className="text-[9.5px] text-slate-700 leading-tight mt-0.5">
                                Jl. Raya Jeru No. 136, RT.01/RW.02, Kec. Tumpang, Kab. Malang, Jawa Timur 65156
                              </p>
                              <p className="text-[9.5px] text-slate-700 leading-tight">
                                Email: sppg.jeru.tumpang@bgn.go.id • Hotline / WA: 0812-3456-7890
                              </p>
                            </div>
                          </div>

                          {/* Judul Dokumen */}
                          <div className="text-center my-3">
                            <h2 className="text-sm font-bold text-slate-950 tracking-normal">
                              Formulir Uji Organoleptik & Penilaian Sensorik Makanan
                            </h2>
                            <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                              No. Pengujian: <span className="font-bold text-slate-900">UO-SPPG/{dateCode}/{docNumSuffix}</span>
                            </div>
                          </div>

                          {/* Data Uji Sampling */}
                          <div className="grid grid-cols-2 gap-3 p-2 bg-slate-50 border border-slate-300 rounded mb-3 text-[10.5px]">
                            <div className="space-y-1">
                              <div className="flex">
                                <span className="w-24 font-semibold text-slate-600">Sekolah / Titik Uji</span>
                                <span className="w-2">:</span>
                                <span className="font-bold text-slate-900">{school.schoolName}</span>
                              </div>
                              <div className="flex">
                                <span className="w-24 font-semibold text-slate-600">Tanggal Uji</span>
                                <span className="w-2">:</span>
                                <span className="text-slate-800">{formatIndonesianDate(selectedDate)}</span>
                              </div>
                              <div className="flex">
                                <span className="w-24 font-semibold text-slate-600">Menu Diuji</span>
                                <span className="w-2">:</span>
                                <span className="font-semibold text-slate-900 truncate">
                                  {currentOrder?.menuTitle || 'Menu Lengkap Gizi SPPG'}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex">
                                <span className="w-28 font-semibold text-slate-600">Jam Tiba Makanan</span>
                                <span className="w-2">:</span>
                                <span className="font-mono text-slate-800">[ ........ : ........ WIB ]</span>
                              </div>
                              <div className="flex">
                                <span className="w-28 font-semibold text-slate-600">Suhu Saat Tiba</span>
                                <span className="w-2">:</span>
                                <span className="font-mono text-slate-800">[ ............ °C ] (Standar &gt;60°C)</span>
                              </div>
                              <div className="flex">
                                <span className="w-28 font-semibold text-slate-600">Jam Mulai Makan</span>
                                <span className="w-2">:</span>
                                <span className="font-mono text-slate-800">[ ........ : ........ WIB ]</span>
                              </div>
                            </div>
                          </div>

                          {/* Skala Penilaian */}
                          <div className="p-2 border border-slate-300 rounded mb-2.5 bg-white text-[10px] flex items-center justify-between text-slate-700">
                            <span className="font-bold text-slate-900">Skala Penilaian Skoring:</span>
                            <span><strong>5</strong> = Sangat Baik</span>
                            <span><strong>4</strong> = Baik (Standar)</span>
                            <span><strong>3</strong> = Cukup</span>
                            <span><strong>2</strong> = Kurang</span>
                            <span><strong>1</strong> = Buruk / Tidak Layak</span>
                          </div>

                          {/* Tabel Parameter Uji Organoleptik */}
                          <div className="mb-3">
                            <table className="w-full text-left text-[11px] border-collapse border border-slate-800">
                              <thead>
                                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                                  <th className="py-1.5 px-2 border border-slate-800 w-8 text-center">No</th>
                                  <th className="py-1.5 px-2.5 border border-slate-800 w-36">Parameter Uji</th>
                                  <th className="py-1.5 px-3 border border-slate-800">Kriteria Standar Mutu Sensorik</th>
                                  <th className="py-1.5 px-2 border border-slate-800 w-20 text-center">Skor (1-5)</th>
                                  <th className="py-1.5 px-2.5 border border-slate-800 w-44">Catatan Evaluator</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono">1</td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 font-semibold">Aroma & Bau</td>
                                  <td className="py-1.5 px-3 border border-slate-800 text-[10px] text-slate-700">
                                    Aroma segar sedap khas masakan alami, tidak berbau asam, basi, apek, atau tengik.
                                  </td>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono font-bold text-slate-400">
                                    [ &nbsp;&nbsp;&nbsp;&nbsp; ]
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-[10px] text-slate-400">
                                    ..................................................
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono">2</td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 font-semibold">Rasa & Kelezatan</td>
                                  <td className="py-1.5 px-3 border border-slate-800 text-[10px] text-slate-700">
                                    Tingkat gurih dan keasinan pas, bumbu meresap merata, tidak hambar dan disukai siswa.
                                  </td>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono font-bold text-slate-400">
                                    [ &nbsp;&nbsp;&nbsp;&nbsp; ]
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-[10px] text-slate-400">
                                    ..................................................
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono">3</td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 font-semibold">Tekstur & Keempukan</td>
                                  <td className="py-1.5 px-3 border border-slate-800 text-[10px] text-slate-700">
                                    Nasi matang pulen empuk, lauk matang sempurna, sayur segar renyah (tidak lembek/overcooked).
                                  </td>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono font-bold text-slate-400">
                                    [ &nbsp;&nbsp;&nbsp;&nbsp; ]
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-[10px] text-slate-400">
                                    ..................................................
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono">4</td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 font-semibold">Warna & Penampilan</td>
                                  <td className="py-1.5 px-3 border border-slate-800 text-[10px] text-slate-700">
                                    Warna sayur cerah alami menggugah selera, penataan sekat tray rapi, bersih, tidak tercampur.
                                  </td>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono font-bold text-slate-400">
                                    [ &nbsp;&nbsp;&nbsp;&nbsp; ]
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-[10px] text-slate-400">
                                    ..................................................
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono">5</td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 font-semibold">Suhu Saat Disajikan</td>
                                  <td className="py-1.5 px-3 border border-slate-800 text-[10px] text-slate-700">
                                    Makanan masih hangat aman saat disajikan kepada siswa (standar rantai suhu aman).
                                  </td>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono font-bold text-slate-400">
                                    [ &nbsp;&nbsp;&nbsp;&nbsp; ]
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-[10px] text-slate-400">
                                    ..................................................
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono">6</td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 font-semibold">Kebersihan Kemasan</td>
                                  <td className="py-1.5 px-3 border border-slate-800 text-[10px] text-slate-700">
                                    Tray dan tutup steril, tertutup rapat tanpa celah, bebas dari debu atau benda asing.
                                  </td>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono font-bold text-slate-400">
                                    [ &nbsp;&nbsp;&nbsp;&nbsp; ]
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-[10px] text-slate-400">
                                    ..................................................
                                  </td>
                                </tr>
                              </tbody>
                              <tfoot>
                                <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-[11px]">
                                  <td colSpan={3} className="py-1.5 px-3 border border-slate-800 text-right">
                                    Total Skor / Rata-rata Skor Sensorik:
                                  </td>
                                  <td className="py-1.5 px-2 border border-slate-800 text-center font-mono text-slate-400">
                                    [ &nbsp;&nbsp;&nbsp; / 30 ]
                                  </td>
                                  <td className="py-1.5 px-2.5 border border-slate-800 text-[10px] text-slate-700">
                                    Rata-rata: [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / 5 ]
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>

                          {/* Kesimpulan Kelayakan */}
                          <div className="flex items-center gap-6 p-2 border border-slate-300 rounded mb-3 bg-slate-50 text-[10.5px]">
                            <span className="font-bold text-slate-900">Kesimpulan Kelayakan:</span>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <span className="w-3.5 h-3.5 border border-slate-800 inline-block"></span>
                              <span>Layak Dikonsumsi</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <span className="w-3.5 h-3.5 border border-slate-800 inline-block"></span>
                              <span>Layak dengan Catatan Perbaikan</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <span className="w-3.5 h-3.5 border border-slate-800 inline-block"></span>
                              <span>Tidak Layak Dikonsumsi</span>
                            </label>
                          </div>

                          {/* Kotak Kritik & Saran dari Pihak Sekolah */}
                          <div className="mb-4">
                            <div className="text-[11px] font-bold text-slate-900 mb-1">
                              Kritik & Saran dari Pihak Sekolah / Komite / Guru:
                            </div>
                            <div className="border border-slate-400 rounded p-2.5 min-h-[75px] text-[10px] text-slate-400 space-y-3 bg-white">
                              <div className="border-b border-dashed border-slate-300 pb-1">
                                Masukan rasa / porsi / variasi menu: ........................................................................................................................................
                              </div>
                              <div className="border-b border-dashed border-slate-300 pb-1">
                                Catatan respon dan kepuasan siswa: ........................................................................................................................................
                              </div>
                              <div className="border-b border-dashed border-slate-300 pb-1">
                                Masukan waktu pengiriman / peralatan: ........................................................................................................................................
                              </div>
                            </div>
                          </div>

                          {/* Tanda Tangan Evaluasi Organoleptik */}
                          <div className="pt-1">
                            <div className="grid grid-cols-2 gap-10 text-center text-[10.5px]">
                              {/* Penguji Organoleptik Sekolah */}
                              <div className="p-2 flex flex-col justify-between min-h-[85px]">
                                <div>
                                  <div className="font-semibold text-slate-700">Petugas Penguji Organoleptik Sekolah</div>
                                  <div className="text-[9.5px] text-slate-500">Guru / Tim Pengawas Mutu {school.schoolName}</div>
                                </div>
                                <div className="mt-12 border-t border-slate-800 pt-1">
                                  <div className="font-bold text-slate-900 underline">
                                    ( {school.contactPerson || '...........................................'} )
                                  </div>
                                  <div className="text-[9.5px] text-slate-500">NIP / Jabatan: .......................................</div>
                                </div>
                              </div>

                              {/* Saksi Asisten Lapangan */}
                              <div className="p-2 flex flex-col justify-between min-h-[85px]">
                                <div>
                                  <div className="font-semibold text-slate-700">Saksi Asisten Lapangan SPPG</div>
                                  <div className="text-[9.5px] text-slate-500">Petugas Pengantar SPPG Jeru Tumpang</div>
                                </div>
                                <div className="mt-12 border-t border-slate-800 pt-1">
                                  <div className="font-bold text-slate-900 underline">
                                    {officerSettings.fieldAssistantName}
                                  </div>
                                  <div className="text-[9.5px] text-slate-500">Asisten Lapangan Distribusi</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="text-right text-[8.5px] text-slate-400 mt-2 font-mono">
                            Lembar 3 dari 3 • Dokumen Resmi SPPG Jeru Tumpang
                          </div>
                        </div>
                      )}
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
