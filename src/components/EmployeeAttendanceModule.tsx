import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import {
  Employee,
  EmployeeAttendance,
  EmployeeDepartment,
  EmployeeShift,
  EmploymentType,
  AttendanceStatus,
} from '../types/warehouse';
import {
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Plus,
  Search,
  Filter,
  UserCheck,
  UserX,
  ShieldCheck,
  Edit2,
  Trash2,
  Camera,
  X,
  Info,
  ChevronDown,
  Building,
  Phone,
  MapPin,
  Check,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { exportToExcel } from '../lib/excelExport';
import { SppgLogo } from './SppgLogo';
import { PhotoUploadCompressor } from './PhotoUploadCompressor';

const DEPARTMENTS: EmployeeDepartment[] = [
  'Dapur & Masak',
  'Gudang & Logistik',
  'Distribusi & Transport',
  'Sanitasi & Kebersihan',
  'Manajemen & Administrasi',
  'Gizi & Mutu',
];

const SHIFTS: EmployeeShift[] = [
  'Pagi (05:00 - 13:00)',
  'Siang (10:00 - 18:00)',
  'Full Day (05:00 - 17:00)',
];

const EMPLOYMENT_TYPES: EmploymentType[] = [
  'Tetap',
  'Kontrak',
  'Relawan / Mitra Harian',
];

export const EmployeeAttendanceModule: React.FC = () => {
  const { currentUser } = useAuth();

  // Active Tab: ATTENDANCE or EMPLOYEES
  const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'EMPLOYEES'>('ATTENDANCE');

  // Selected Date for Attendance (Default to today in local YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Data Refresh Trigger
  const [dataVersion, setDataVersion] = useState(0);
  const refreshData = () => setDataVersion(v => v + 1);

  // Load Data from Database
  const employees = useMemo(() => warehouseDb.getEmployees(), [dataVersion]);
  const allAttendances = useMemo(() => warehouseDb.getAttendanceLogs(), [dataVersion]);

  // Attendance for the selected date
  const attendancesForDate = useMemo(() => {
    return allAttendances.filter(a => a.date === selectedDate);
  }, [allAttendances, selectedDate]);

  // Active employees
  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status === 'AKTIF');
  }, [employees]);

  // Combined attendance records for all active employees on selectedDate
  interface AttendanceRowView {
    employee: Employee;
    attendance?: EmployeeAttendance;
    status: AttendanceStatus | 'BELUM_ABSEN';
  }

  const attendanceRowViews = useMemo<AttendanceRowView[]>(() => {
    return activeEmployees.map(emp => {
      const att = attendancesForDate.find(a => a.employeeId === emp.id);
      return {
        employee: emp,
        attendance: att,
        status: att ? att.status : 'BELUM_ABSEN',
      };
    });
  }, [activeEmployees, attendancesForDate]);

  // Filtered attendance rows
  const filteredAttendanceRows = useMemo(() => {
    return attendanceRowViews.filter(row => {
      const matchesSearch =
        row.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.employee.nip.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.employee.position.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDept = selectedDept === 'ALL' || row.employee.department === selectedDept;
      const matchesStatus = selectedStatus === 'ALL' || row.status === selectedStatus;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [attendanceRowViews, searchQuery, selectedDept, selectedStatus]);

  // Attendance KPI Metrics
  const metrics = useMemo(() => {
    const total = activeEmployees.length;
    let hadir = 0;
    let terlambat = 0;
    let izin = 0;
    let sakit = 0;
    let alpa = 0;
    let belumAbsen = 0;

    attendanceRowViews.forEach(row => {
      if (row.status === 'HADIR') hadir++;
      else if (row.status === 'TERLAMBAT') terlambat++;
      else if (row.status === 'IZIN') izin++;
      else if (row.status === 'SAKIT') sakit++;
      else if (row.status === 'ALPA') alpa++;
      else belumAbsen++;
    });

    const attendedCount = hadir + terlambat;
    const rate = total > 0 ? Math.round((attendedCount / total) * 100) : 0;

    return {
      total,
      hadir,
      terlambat,
      izin,
      sakit,
      alpa,
      belumAbsen,
      rate,
    };
  }, [activeEmployees, attendanceRowViews]);

  // Filtered employees for Master Employees Tab
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch =
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.nip.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.phone.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDept = selectedDept === 'ALL' || emp.department === selectedDept;
      const matchesStatus = selectedStatus === 'ALL' || emp.status === selectedStatus;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [employees, searchQuery, selectedDept, selectedStatus]);

  // -------------------------------------------------------------
  // MODAL STATES
  // -------------------------------------------------------------

  // 1. Quick Batch Daily Attendance Checklist Modal
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [quickRows, setQuickRows] = useState<
    Array<{
      employeeId: string;
      name: string;
      department: EmployeeDepartment;
      position: string;
      shift: EmployeeShift;
      status: AttendanceStatus;
      checkInTime: string;
      lateMinutes: number;
      notes: string;
    }>
  >([]);

  const handleOpenQuickAttendance = () => {
    const rows = activeEmployees.map(emp => {
      const existing = attendancesForDate.find(a => a.employeeId === emp.id);
      return {
        employeeId: emp.id,
        name: emp.name,
        department: emp.department,
        position: emp.position,
        shift: emp.shift,
        status: existing ? existing.status : 'HADIR',
        checkInTime: existing ? existing.checkInTime : '05:00',
        lateMinutes: existing ? (existing.lateMinutes || 0) : 0,
        notes: existing ? (existing.notes || '') : '',
      };
    });
    setQuickRows(rows);
    setIsQuickModalOpen(true);
  };

  const handleSetAllPresent = () => {
    setQuickRows(prev =>
      prev.map(row => ({
        ...row,
        status: 'HADIR',
        checkInTime: '05:00',
        lateMinutes: 0,
      }))
    );
  };

  const handleSaveQuickAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    const entries = quickRows.map(row => ({
      date: selectedDate,
      employeeId: row.employeeId,
      employeeName: row.name,
      department: row.department,
      position: row.position,
      shift: row.shift,
      checkInTime: row.status === 'IZIN' || row.status === 'SAKIT' || row.status === 'ALPA' ? '' : row.checkInTime,
      status: row.status,
      lateMinutes: row.status === 'TERLAMBAT' ? Number(row.lateMinutes || 0) : 0,
      notes: row.notes,
      recordedBy: currentUser.name,
      verified: true,
    }));

    warehouseDb.recordBatchAttendance(entries, currentUser);
    refreshData();
    setIsQuickModalOpen(false);
    showToast(`Presensi harian ${entries.length} staf berhasil dicatat untuk tanggal ${selectedDate}.`);
  };

  // 2. Single Attendance Modal (Add or Edit individual attendance)
  const [isSingleAttModalOpen, setIsSingleAttModalOpen] = useState(false);
  const [singleAttEmpId, setSingleAttEmpId] = useState('');
  const [singleAttDate, setSingleAttDate] = useState(selectedDate);
  const [singleAttCheckIn, setSingleAttCheckIn] = useState('05:00');
  const [singleAttCheckOut, setSingleAttCheckOut] = useState('');
  const [singleAttStatus, setSingleAttStatus] = useState<AttendanceStatus>('HADIR');
  const [singleAttLateMinutes, setSingleAttLateMinutes] = useState<number>(0);
  const [singleAttNotes, setSingleAttNotes] = useState('');
  const [singleAttPhotos, setSingleAttPhotos] = useState<string[]>([]);

  const handleOpenSingleAtt = (emp?: Employee, existingAtt?: EmployeeAttendance) => {
    const targetEmp = emp || activeEmployees[0];
    if (!targetEmp) {
      alert('Belum ada data staf yang terdaftar.');
      return;
    }

    setSingleAttEmpId(targetEmp.id);
    setSingleAttDate(selectedDate);

    if (existingAtt) {
      setSingleAttCheckIn(existingAtt.checkInTime || '05:00');
      setSingleAttCheckOut(existingAtt.checkOutTime || '');
      setSingleAttStatus(existingAtt.status);
      setSingleAttLateMinutes(existingAtt.lateMinutes || 0);
      setSingleAttNotes(existingAtt.notes || '');
      setSingleAttPhotos(existingAtt.photoUrl ? [existingAtt.photoUrl] : []);
    } else {
      setSingleAttCheckIn('05:00');
      setSingleAttCheckOut('');
      setSingleAttStatus('HADIR');
      setSingleAttLateMinutes(0);
      setSingleAttNotes('');
      setSingleAttPhotos([]);
    }

    setIsSingleAttModalOpen(true);
  };

  const handleSaveSingleAtt = (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmp = employees.find(e => e.id === singleAttEmpId);
    if (!targetEmp) return;

    warehouseDb.recordAttendance(
      {
        date: singleAttDate,
        employeeId: targetEmp.id,
        employeeName: targetEmp.name,
        department: targetEmp.department,
        position: targetEmp.position,
        shift: targetEmp.shift,
        checkInTime: singleAttStatus === 'IZIN' || singleAttStatus === 'SAKIT' || singleAttStatus === 'ALPA' ? '' : singleAttCheckIn,
        checkOutTime: singleAttCheckOut,
        status: singleAttStatus,
        lateMinutes: singleAttStatus === 'TERLAMBAT' ? Number(singleAttLateMinutes || 0) : 0,
        photoUrl: singleAttPhotos[0] || '',
        notes: singleAttNotes,
        recordedBy: currentUser.name,
        verified: true,
      },
      currentUser
    );

    refreshData();
    setIsSingleAttModalOpen(false);
    showToast(`Presensi staf ${targetEmp.name} berhasil disimpan.`);
  };

  // 3. Employee Master Modal (Add or Edit Employee)
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [empName, setEmpName] = useState('');
  const [empNik, setEmpNik] = useState('');
  const [empNip, setEmpNip] = useState('');
  const [empGender, setEmpGender] = useState<'L' | 'P'>('L');
  const [empPhone, setEmpPhone] = useState('');
  const [empDept, setEmpDept] = useState<EmployeeDepartment>('Dapur & Masak');
  const [empPosition, setEmpPosition] = useState('');
  const [empEmploymentType, setEmpEmploymentType] = useState<EmploymentType>('Kontrak');
  const [empShift, setEmpShift] = useState<EmployeeShift>('Pagi (05:00 - 13:00)');
  const [empJoinDate, setEmpJoinDate] = useState(todayStr);
  const [empStatus, setEmpStatus] = useState<'AKTIF' | 'CUTI' | 'NONAKTIF'>('AKTIF');
  const [empAddress, setEmpAddress] = useState('');
  const [empEmergencyContact, setEmpEmergencyContact] = useState('');
  const [empNotes, setEmpNotes] = useState('');

  const handleOpenAddEmployee = () => {
    setEditingEmployeeId(null);
    setEmpName('');
    setEmpNik('');
    const nextNip = `SPPG-JT-${String(employees.length + 1).padStart(3, '0')}`;
    setEmpNip(nextNip);
    setEmpGender('L');
    setEmpPhone('');
    setEmpDept('Dapur & Masak');
    setEmpPosition('');
    setEmpEmploymentType('Kontrak');
    setEmpShift('Pagi (05:00 - 13:00)');
    setEmpJoinDate(todayStr);
    setEmpStatus('AKTIF');
    setEmpAddress('Kec. Tumpang, Kab. Malang');
    setEmpEmergencyContact('');
    setEmpNotes('');
    setIsEmployeeModalOpen(true);
  };

  const handleOpenEditEmployee = (emp: Employee) => {
    setEditingEmployeeId(emp.id);
    setEmpName(emp.name);
    setEmpNik(emp.nik);
    setEmpNip(emp.nip);
    setEmpGender(emp.gender);
    setEmpPhone(emp.phone);
    setEmpDept(emp.department);
    setEmpPosition(emp.position);
    setEmpEmploymentType(emp.employmentType);
    setEmpShift(emp.shift);
    setEmpJoinDate(emp.joinDate);
    setEmpStatus(emp.status);
    setEmpAddress(emp.address);
    setEmpEmergencyContact(emp.emergencyContact);
    setEmpNotes(emp.notes || '');
    setIsEmployeeModalOpen(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim()) {
      alert('Nama karyawan wajib diisi.');
      return;
    }

    if (editingEmployeeId) {
      warehouseDb.updateEmployee(
        editingEmployeeId,
        {
          name: empName.trim(),
          nik: empNik.trim(),
          nip: empNip.trim(),
          gender: empGender,
          phone: empPhone.trim(),
          department: empDept,
          position: empPosition.trim(),
          employmentType: empEmploymentType,
          shift: empShift,
          joinDate: empJoinDate,
          status: empStatus,
          address: empAddress.trim(),
          emergencyContact: empEmergencyContact.trim(),
          notes: empNotes.trim(),
        },
        currentUser
      );
      showToast(`Data staf ${empName} berhasil diperbarui.`);
    } else {
      warehouseDb.saveEmployee(
        {
          name: empName.trim(),
          nik: empNik.trim(),
          nip: empNip.trim(),
          gender: empGender,
          phone: empPhone.trim(),
          department: empDept,
          position: empPosition.trim(),
          employmentType: empEmploymentType,
          shift: empShift,
          joinDate: empJoinDate,
          status: empStatus,
          address: empAddress.trim(),
          emergencyContact: empEmergencyContact.trim(),
          notes: empNotes.trim(),
        },
        currentUser
      );
      showToast(`Staf baru ${empName} berhasil ditambahkan.`);
    }

    refreshData();
    setIsEmployeeModalOpen(false);
  };

  const handleDeleteEmployee = (emp: Employee) => {
    if (confirm(`Yakin ingin menghapus data staf "${emp.name}" (${emp.nip})?`)) {
      warehouseDb.deleteEmployee(emp.id, currentUser);
      refreshData();
      showToast(`Staf ${emp.name} telah dihapus.`);
    }
  };

  // 4. Photo Proof Preview Modal
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  // -------------------------------------------------------------
  // EXPORT FUNCTIONS
  // -------------------------------------------------------------

  const handleExportAttendanceExcel = () => {
    const exportData = filteredAttendanceRows.map((row, idx) => ({
      'No': idx + 1,
      'Tanggal': selectedDate,
      'NIP': row.employee.nip,
      'Nama Karyawan': row.employee.name,
      'Departemen / Divisi': row.employee.department,
      'Jabatan': row.employee.position,
      'Shift Kerja': row.employee.shift,
      'Status Kehadiran': row.status,
      'Jam Masuk': row.attendance?.checkInTime || '-',
      'Jam Pulang': row.attendance?.checkOutTime || '-',
      'Terlambat (Menit)': row.attendance?.lateMinutes || 0,
      'Keterangan / Alasan': row.attendance?.notes || '-',
      'Petugas Pencatat': row.attendance?.recordedBy || '-',
      'Terverifikasi': row.attendance?.verified ? 'Ya' : 'Belum',
    }));

    exportToExcel(
      exportData,
      `Rekap_Presensi_SPPG_Jeru_Tumpang_${selectedDate}.xlsx`,
      'Rekap Presensi Harian'
    );
  };

  const handleExportEmployeesExcel = () => {
    const exportData = filteredEmployees.map((emp, idx) => ({
      'No': idx + 1,
      'ID Sistem': emp.id,
      'NIP SPPG': emp.nip,
      'NIK KTP': emp.nik,
      'Nama Lengkap': emp.name,
      'L/P': emp.gender,
      'Departemen / Divisi': emp.department,
      'Jabatan': emp.position,
      'Status Hubungan Kerja': emp.employmentType,
      'Shift Kerja': emp.shift,
      'Tanggal Bergabung': emp.joinDate,
      'Status Keaktifan': emp.status,
      'No. WhatsApp': emp.phone,
      'Kontak Darurat': emp.emergencyContact,
      'Alamat Domisili': emp.address,
      'Catatan': emp.notes || '-',
    }));

    exportToExcel(
      exportData,
      `Master_Data_Karyawan_SPPG_Jeru_Tumpang_${todayStr}.xlsx`,
      'Master Data Staf'
    );
  };

  const getStatusBadge = (status: AttendanceStatus | 'BELUM_ABSEN') => {
    switch (status) {
      case 'HADIR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Check className="w-3 h-3 text-emerald-600" />
            Hadir
          </span>
        );
      case 'TERLAMBAT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Terlambat
          </span>
        );
      case 'IZIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
            <Info className="w-3 h-3 text-sky-600" />
            Izin
          </span>
        );
      case 'SAKIT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            <AlertTriangle className="w-3 h-3 text-purple-600" />
            Sakit
          </span>
        );
      case 'ALPA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <UserX className="w-3 h-3 text-rose-600" />
            Alpa
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
            Belum Absen
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 bg-white p-5 rounded-2xl border shadow-xs">
        <div className="flex items-center gap-3.5">
          <SppgLogo size="md" variant="color" />
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Manajemen Karyawan & Presensi Kerja
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pusat data staf operasional dapur gizi, monitoring jam kerja, presensi harian, dan dokumentasi kehadiran SPPG Jeru Tumpang.
            </p>
          </div>
        </div>

        {/* Tab Switcher & Print Action */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('ATTENDANCE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'ATTENDANCE'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              Presensi Harian
            </button>
            <button
              onClick={() => setActiveTab('EMPLOYEES')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'EMPLOYEES'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              Master Karyawan ({employees.length})
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
            title="Cetak Laporan / Berita Acara Presensi"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Cetak</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: PRESENSI & ABSENSI HARIAN
      ========================================================================= */}
      {activeTab === 'ATTENDANCE' && (
        <div className="space-y-5">
          {/* KPI Kehadiran Harian */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500">Total Karyawan Aktif</span>
              <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{metrics.total}</div>
              <span className="text-[10px] text-slate-400">Personil SPPG Jeru Tumpang</span>
            </div>

            <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-600" /> Hadir Tepat Waktu
              </span>
              <div className="text-2xl font-bold text-emerald-900 mt-1 tabular-nums">{metrics.hadir}</div>
              <span className="text-[10px] text-emerald-700">Tiba sebelum batas jam shift</span>
            </div>

            <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-600" /> Terlambat
              </span>
              <div className="text-2xl font-bold text-amber-900 mt-1 tabular-nums">{metrics.terlambat}</div>
              <span className="text-[10px] text-amber-700">Terdapat toleransi & catatan</span>
            </div>

            <div className="bg-purple-50/60 p-3.5 rounded-xl border border-purple-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-purple-800 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-purple-600" /> Izin & Sakit
              </span>
              <div className="text-2xl font-bold text-purple-900 mt-1 tabular-nums">{metrics.izin + metrics.sakit}</div>
              <span className="text-[10px] text-purple-700">Izin: {metrics.izin} • Sakit: {metrics.sakit}</span>
            </div>

            <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-rose-800 flex items-center gap-1">
                <UserX className="w-3 h-3 text-rose-600" /> Alpa / Belum Absen
              </span>
              <div className="text-2xl font-bold text-rose-900 mt-1 tabular-nums">{metrics.alpa + metrics.belumAbsen}</div>
              <span className="text-[10px] text-rose-700">Alpa: {metrics.alpa} • Belum: {metrics.belumAbsen}</span>
            </div>

            <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-300">Tingkat Kehadiran</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">{metrics.rate}%</div>
              <span className="text-[10px] text-slate-400">Total kehadiran hari ini</span>
            </div>
          </div>

          {/* Action & Filter Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Left: Date navigation */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs font-semibold text-slate-800 cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  selectedDate === todayStr
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Hari Ini
              </button>

              <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>

              {/* Department Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedDept}
                  onChange={e => setSelectedDept(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ALL">Semua Departemen</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">Semua Status</option>
                <option value="HADIR">Hadir</option>
                <option value="TERLAMBAT">Terlambat</option>
                <option value="IZIN">Izin</option>
                <option value="SAKIT">Sakit</option>
                <option value="ALPA">Alpa</option>
                <option value="BELUM_ABSEN">Belum Absen</option>
              </select>
            </div>

            {/* Right: Search & Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama, NIP, posisi..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Quick Attendance Checklist (1-Click) */}
              <button
                type="button"
                onClick={handleOpenQuickAttendance}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs transition-colors cursor-pointer"
                title="Presensi serentak seluruh staf hari ini"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Presensi Cepat 1-Klik</span>
              </button>

              {/* Single Attendance Record */}
              <button
                type="button"
                onClick={() => handleOpenSingleAtt()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
                title="Catat kehadiran staf individu"
              >
                <Plus className="w-3.5 h-3.5 text-slate-500" />
                <span>Catat Absensi</span>
              </button>

              {/* Export to Excel */}
              <button
                type="button"
                onClick={handleExportAttendanceExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 shadow-2xs transition-colors cursor-pointer"
                title="Unduh laporan presensi format Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Ekspor Excel</span>
              </button>
            </div>
          </div>

          {/* Tabel Presensi Harian */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Daftar Presensi Karyawan — {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Menampilkan {filteredAttendanceRows.length} dari {activeEmployees.length} karyawan aktif SPPG Jeru Tumpang.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/75 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 w-12 text-center">No</th>
                    <th className="py-2.5 px-4">Karyawan & NIP</th>
                    <th className="py-2.5 px-4">Departemen & Jabatan</th>
                    <th className="py-2.5 px-4">Shift Kerja</th>
                    <th className="py-2.5 px-4 text-center">Jam Masuk</th>
                    <th className="py-2.5 px-4 text-center">Jam Pulang</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4">Keterangan / Alasan</th>
                    <th className="py-2.5 px-4 text-center">Bukti Foto</th>
                    <th className="py-2.5 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAttendanceRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-400">
                        Tidak ada data presensi yang sesuai filter pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredAttendanceRows.map((row, idx) => (
                      <tr key={row.employee.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0 border border-emerald-200">
                              {row.employee.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{row.employee.name}</div>
                              <div className="text-[10px] font-mono text-slate-400">{row.employee.nip}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">{row.employee.position}</div>
                          <div className="text-[10px] text-slate-500">{row.employee.department}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {row.employee.shift}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-medium text-slate-700">
                          {row.attendance?.checkInTime ? (
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {row.attendance.checkInTime}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-medium text-slate-700">
                          {row.attendance?.checkOutTime ? (
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {row.attendance.checkOutTime}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {getStatusBadge(row.status)}
                          {row.status === 'TERLAMBAT' && row.attendance?.lateMinutes ? (
                            <div className="text-[10px] text-amber-700 font-medium mt-0.5">
                              +{row.attendance.lateMinutes} mnt
                            </div>
                          ) : null}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-600">
                          {row.attendance?.notes ? (
                            <span title={row.attendance.notes}>{row.attendance.notes}</span>
                          ) : (
                            <span className="text-slate-300 italic">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.attendance?.photoUrl ? (
                            <button
                              type="button"
                              onClick={() => setPhotoPreviewUrl(row.attendance!.photoUrl!)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 transition-colors cursor-pointer"
                            >
                              <Camera className="w-3 h-3 text-emerald-600" />
                              Lihat Foto
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenSingleAtt(row.employee, row.attendance)}
                            className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                            title="Edit presensi staf ini"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: MASTER DATA KARYAWAN (DAFTAR STAF)
      ========================================================================= */}
      {activeTab === 'EMPLOYEES' && (
        <div className="space-y-5">
          {/* Sebaran Staf Per Departemen */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {DEPARTMENTS.map(dept => {
              const count = employees.filter(e => e.department === dept && e.status === 'AKTIF').length;
              return (
                <div key={dept} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-semibold text-slate-500 truncate">{dept}</div>
                  <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                    {count} <span className="text-xs font-normal text-slate-400">staf</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Toolbar Master Karyawan */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama, NIP, no WA..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">Semua Departemen</option>
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">Semua Status</option>
                <option value="AKTIF">Aktif</option>
                <option value="CUTI">Cuti</option>
                <option value="NONAKTIF">Nonaktif</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddEmployee}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Karyawan</span>
              </button>

              <button
                type="button"
                onClick={handleExportEmployeesExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 shadow-2xs transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Ekspor Master Excel</span>
              </button>
            </div>
          </div>

          {/* Tabel Master Karyawan */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/75 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 w-12 text-center">No</th>
                    <th className="py-2.5 px-4">Nama Lengkap & NIP</th>
                    <th className="py-2.5 px-4">Departemen & Posisi</th>
                    <th className="py-2.5 px-4">Status Kerja & Shift</th>
                    <th className="py-2.5 px-4">Kontak WhatsApp</th>
                    <th className="py-2.5 px-4">Alamat Domisili</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        Tidak ada karyawan yang sesuai kriteria filter.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp, idx) => (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-800 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-200">
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                {emp.name}
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-100 text-slate-600 border border-slate-200">
                                  {emp.gender}
                                </span>
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">{emp.nip} • NIK: {emp.nik || '-'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{emp.position}</div>
                          <div className="text-[10px] text-emerald-700 font-medium">{emp.department}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-700">{emp.employmentType}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{emp.shift}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {emp.phone ? (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{emp.phone}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          {emp.address || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              emp.status === 'AKTIF'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : emp.status === 'CUTI'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {emp.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditEmployee(emp)}
                              className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                              title="Ubah data karyawan"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEmployee(emp)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Hapus data karyawan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: QUICK BATCH DAILY ATTENDANCE (1-CLICK CHECKLIST)
      ========================================================================= */}
      {isQuickModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Presensi Cepat 1-Klik — SPPG Jeru Tumpang
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tanggal Operasional: <strong className="text-slate-700 font-semibold">{selectedDate}</strong> • Total {quickRows.length} staf aktif
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSetAllPresent}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer"
                  title="Otomatis tandai semua staf hadir tepat waktu pukul 05:00"
                >
                  Set Semua Hadir (05:00)
                </button>
                <button
                  type="button"
                  onClick={() => setIsQuickModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body / Table */}
            <form onSubmit={handleSaveQuickAttendance} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Secara default seluruh staf disetel Hadir. Sesuaikan status staf yang Terlambat, Izin, Sakit, atau Alpa beserta jam dan keterangannya jika ada.
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">No</th>
                        <th className="py-2.5 px-3">Nama Karyawan & Jabatan</th>
                        <th className="py-2.5 px-3 w-36">Status Kehadiran</th>
                        <th className="py-2.5 px-3 w-28 text-center">Jam Masuk</th>
                        <th className="py-2.5 px-3">Catatan / Alasan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {quickRows.map((row, idx) => (
                        <tr key={row.employeeId} className="hover:bg-slate-50/75">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">{row.name}</div>
                            <div className="text-[10px] text-slate-500">{row.position} • {row.department}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={row.status}
                              onChange={e => {
                                const newStatus = e.target.value as AttendanceStatus;
                                setQuickRows(prev =>
                                  prev.map((r, i) =>
                                    i === idx
                                      ? {
                                          ...r,
                                          status: newStatus,
                                          checkInTime: newStatus === 'IZIN' || newStatus === 'SAKIT' || newStatus === 'ALPA' ? '' : r.checkInTime || '05:00',
                                        }
                                      : r
                                  )
                                );
                              }}
                              className={`w-full text-xs font-semibold rounded-lg px-2 py-1.5 border focus:outline-none ${
                                row.status === 'HADIR'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : row.status === 'TERLAMBAT'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : row.status === 'IZIN'
                                  ? 'bg-sky-50 text-sky-800 border-sky-300'
                                  : row.status === 'SAKIT'
                                  ? 'bg-purple-50 text-purple-800 border-purple-300'
                                  : 'bg-rose-50 text-rose-800 border-rose-300'
                              }`}
                            >
                              <option value="HADIR">Hadir</option>
                              <option value="TERLAMBAT">Terlambat</option>
                              <option value="IZIN">Izin</option>
                              <option value="SAKIT">Sakit</option>
                              <option value="ALPA">Alpa</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {row.status === 'HADIR' || row.status === 'TERLAMBAT' ? (
                              <input
                                type="time"
                                value={row.checkInTime}
                                onChange={e => {
                                  const val = e.target.value;
                                  setQuickRows(prev =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, checkInTime: val } : r
                                    )
                                  );
                                }}
                                className="w-24 text-center font-mono text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            ) : (
                              <span className="text-slate-300 italic">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              placeholder="Keterangan singkat..."
                              value={row.notes}
                              onChange={e => {
                                const val = e.target.value;
                                setQuickRows(prev =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, notes: val } : r
                                  )
                                );
                              }}
                              className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">
                  Dicatat atas nama: <strong className="text-slate-700">{currentUser.name}</strong> ({currentUser.role})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsQuickModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Simpan Presensi Harian
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: SINGLE ATTENDANCE FORM (INDIVIDUAL & FOTO BUKTI WEBP)
      ========================================================================= */}
      {isSingleAttModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Form Presensi Staf SPPG Jeru Tumpang
                </h3>
                <p className="text-xs text-slate-500">
                  Catat atau ubah status kehadiran individual beserta jam kerja & bukti foto WebP.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSingleAttModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSingleAtt} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Employee Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pilih Karyawan
                  </label>
                  <select
                    value={singleAttEmpId}
                    onChange={e => setSingleAttEmpId(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  >
                    {activeEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.nip}) — {emp.position} [{emp.department}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date & Shift */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Presensi
                    </label>
                    <input
                      type="date"
                      value={singleAttDate}
                      onChange={e => setSingleAttDate(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 text-slate-800 font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status Kehadiran
                    </label>
                    <select
                      value={singleAttStatus}
                      onChange={e => setSingleAttStatus(e.target.value as AttendanceStatus)}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-semibold focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="HADIR">Hadir (Tepat Waktu)</option>
                      <option value="TERLAMBAT">Terlambat</option>
                      <option value="IZIN">Izin</option>
                      <option value="SAKIT">Sakit</option>
                      <option value="ALPA">Alpa / Tanpa Keterangan</option>
                    </select>
                  </div>
                </div>

                {/* Jam Masuk & Jam Keluar */}
                {(singleAttStatus === 'HADIR' || singleAttStatus === 'TERLAMBAT') && (
                  <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Jam Masuk
                      </label>
                      <input
                        type="time"
                        value={singleAttCheckIn}
                        onChange={e => setSingleAttCheckIn(e.target.value)}
                        className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Jam Pulang
                      </label>
                      <input
                        type="time"
                        value={singleAttCheckOut}
                        onChange={e => setSingleAttCheckOut(e.target.value)}
                        className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Terlambat (Mnt)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={singleAttLateMinutes}
                        onChange={e => setSingleAttLateMinutes(Number(e.target.value))}
                        className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan / Alasan
                  </label>
                  <textarea
                    rows={2}
                    value={singleAttNotes}
                    onChange={e => setSingleAttNotes(e.target.value)}
                    placeholder="Misal: Uji organoleptik menu sup, izin urusan keluarga, flu demam..."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Photo Proof with Auto WebP Compression */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dokumentasi Foto Bukti / Surat Dokter (WebP)
                  </label>
                  <PhotoUploadCompressor
                    photos={singleAttPhotos}
                    onChange={setSingleAttPhotos}
                    maxPhotos={1}
                    folder="profile"
                    label="Unggah Foto Kehadiran / Surat Sakit"
                    description="Otomatis dikonversi ke format WebP & dikompres ~90% agar hemat memori penyimpanan."
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSingleAttModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Simpan Presensi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: EMPLOYEE MASTER (ADD / EDIT)
      ========================================================================= */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingEmployeeId ? 'Ubah Data Karyawan' : 'Tambah Karyawan Baru'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Satuan Pelayanan Pemenuhan Gizi (SPPG Jeru Tumpang)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEmployeeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Nama Lengkap & Gender */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Lengkap Karyawan *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Misal: Slamet Riyadi, S.E."
                      value={empName}
                      onChange={e => setEmpName(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Jenis Kelamin
                    </label>
                    <select
                      value={empGender}
                      onChange={e => setEmpGender(e.target.value as 'L' | 'P')}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800"
                    >
                      <option value="L">Laki-Laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </div>
                </div>

                {/* NIP & NIK */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      NIP SPPG *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="SPPG-JT-019"
                      value={empNip}
                      onChange={e => setEmpNip(e.target.value)}
                      className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      NIK KTP (16 Digit)
                    </label>
                    <input
                      type="text"
                      placeholder="350719..."
                      value={empNik}
                      onChange={e => setEmpNik(e.target.value)}
                      className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 text-slate-800"
                    />
                  </div>
                </div>

                {/* Departemen & Jabatan */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Departemen / Divisi *
                    </label>
                    <select
                      value={empDept}
                      onChange={e => setEmpDept(e.target.value as EmployeeDepartment)}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800"
                    >
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Jabatan / Posisi Kerja *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Misal: Juru Masak Sayur & Kuah"
                      value={empPosition}
                      onChange={e => setEmpPosition(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800"
                    />
                  </div>
                </div>

                {/* Hubungan Kerja, Shift, Status */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status Kerja
                    </label>
                    <select
                      value={empEmploymentType}
                      onChange={e => setEmpEmploymentType(e.target.value as EmploymentType)}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    >
                      {EMPLOYMENT_TYPES.map(t => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Shift Kerja
                    </label>
                    <select
                      value={empShift}
                      onChange={e => setEmpShift(e.target.value as EmployeeShift)}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    >
                      {SHIFTS.map(s => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status Keaktifan
                    </label>
                    <select
                      value={empStatus}
                      onChange={e => setEmpStatus(e.target.value as 'AKTIF' | 'CUTI' | 'NONAKTIF')}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-semibold"
                    >
                      <option value="AKTIF">Aktif</option>
                      <option value="CUTI">Cuti</option>
                      <option value="NONAKTIF">Nonaktif</option>
                    </select>
                  </div>
                </div>

                {/* Kontak & Tanggal Bergabung */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      No. WhatsApp / HP
                    </label>
                    <input
                      type="text"
                      placeholder="0812-3456-7890"
                      value={empPhone}
                      onChange={e => setEmpPhone(e.target.value)}
                      className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Bergabung
                    </label>
                    <input
                      type="date"
                      value={empJoinDate}
                      onChange={e => setEmpJoinDate(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium"
                    />
                  </div>
                </div>

                {/* Alamat & Kontak Darurat */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Alamat Domisili
                    </label>
                    <input
                      type="text"
                      placeholder="Desa Jeru, Kec. Tumpang, Kab. Malang"
                      value={empAddress}
                      onChange={e => setEmpAddress(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Kontak Darurat (Nama & No. HP)
                    </label>
                    <input
                      type="text"
                      placeholder="0812-9988-7766 (Istri - Rini)"
                      value={empEmergencyContact}
                      onChange={e => setEmpEmergencyContact(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-800"
                    />
                  </div>
                </div>

                {/* Catatan Tambahan */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Kualifikasi / Keterangan Staf
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Pengalaman memasak, sertifikat higienitas, lisensi mengemudi SIM B1, dll..."
                    value={empNotes}
                    onChange={e => setEmpNotes(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {editingEmployeeId ? 'Simpan Perubahan' : 'Tambahkan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: PHOTO PREVIEW POPUP
      ========================================================================= */}
      {photoPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-4 overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <span className="text-xs font-bold text-slate-800">
                Dokumentasi Bukti Kehadiran (WebP)
              </span>
              <button
                type="button"
                onClick={() => setPhotoPreviewUrl(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-slate-100 max-h-[70vh] flex items-center justify-center">
              <img
                src={photoPreviewUrl}
                alt="Bukti Kehadiran"
                className="w-full h-auto object-contain max-h-[70vh]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
