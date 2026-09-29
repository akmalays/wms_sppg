import React, { useState, useMemo, useEffect } from 'react';
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
  FileText,
} from 'lucide-react';
import { exportToExcel } from '../lib/excelExport';
import { PhotoUploadCompressor } from './PhotoUploadCompressor';
import { SppgLogo } from './SppgLogo';

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

// Helper format tanggal bahasa Indonesia (misal: "29 September 2026")
const formatIndonesianDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

// Helper nama hari bahasa Indonesia (misal: "Selasa")
const getIndonesianDay = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const d = new Date(dateStr + 'T00:00:00');
    return days[d.getDay()] || '';
  } catch {
    return '';
  }
};

// Helper nama hari singkatan (misal: "Sel")
const getIndonesianShortDay = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const d = new Date(dateStr + 'T00:00:00');
    return days[d.getDay()] || '';
  } catch {
    return '';
  }
};

export const EmployeeAttendanceModule: React.FC = () => {
  const { currentUser } = useAuth();

  // Active Tab: ATTENDANCE or EMPLOYEES
  const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'EMPLOYEES'>('ATTENDANCE');

  // Selected Date for Attendance (Default to today in local YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // States untuk modal cetak dokumen resmi SPPG
  const [isPrintAttendanceOpen, setIsPrintAttendanceOpen] = useState(false);
  const [isPrintEmployeesOpen, setIsPrintEmployeesOpen] = useState(false);

  // Filter khusus opsi cetak presensi
  const [attPrintMode, setAttPrintMode] = useState<'DAILY' | 'RANGE'>('DAILY');
  const [attPrintTargetDate, setAttPrintTargetDate] = useState<string>(todayStr);
  const [attPrintStartDate, setAttPrintStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [attPrintEndDate, setAttPrintEndDate] = useState<string>(todayStr);
  const [attPrintDept, setAttPrintDept] = useState<string>('ALL');
  const [attPrintStatus, setAttPrintStatus] = useState<string>('ALL');

  // Filter khusus opsi cetak master karyawan
  const [empPrintDept, setEmpPrintDept] = useState<string>('ALL');
  const [empPrintStatus, setEmpPrintStatus] = useState<string>('ALL');
  const [empPrintSearch, setEmpPrintSearch] = useState<string>('');

  // Sinkronisasi tanggal aktif ke filter cetak harian
  useEffect(() => {
    setAttPrintTargetDate(selectedDate);
  }, [selectedDate]);

  // Tanggal cetak terformat untuk Kop Surat
  const printDate = useMemo(() => {
    return new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

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

  // -------------------------------------------------------------
  // PRINTABLE SHEETS: LAPORAN PRESENSI (HARIAN ATAU RENTANG PERIODE)
  // -------------------------------------------------------------
  const renderPrintableAttendanceSheet = () => {
    const isDaily = attPrintMode === 'DAILY';
    const targetDate = attPrintTargetDate || selectedDate;
    const startDate = attPrintStartDate;
    const endDate = attPrintEndDate;

    // Filter employees according to attPrintDept and searchQuery
    const targetEmployees = activeEmployees.filter(emp => {
      const matchSearch =
        !searchQuery.trim() ||
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.nip.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchQuery.toLowerCase());
      const matchDept = attPrintDept === 'ALL' || emp.department === attPrintDept;
      return matchSearch && matchDept;
    });

    // Departments to display
    const departmentsToRender =
      attPrintDept === 'ALL'
        ? DEPARTMENTS.filter(d => targetEmployees.some(e => e.department === d))
        : [attPrintDept as EmployeeDepartment];

    // Data computation depending on DAILY vs RANGE
    // 1. DAILY MODE
    const dailyLogs = allAttendances.filter(a => a.date === targetDate);
    const allDailyRowViews = targetEmployees.map(emp => {
      const att = dailyLogs.find(a => a.employeeId === emp.id);
      return {
        employee: emp,
        attendance: att,
        status: att ? att.status : ('BELUM_ABSEN' as AttendanceStatus | 'BELUM_ABSEN'),
      };
    });

    let dailyHadir = 0;
    let dailyTerlambat = 0;
    let dailyIzin = 0;
    let dailySakit = 0;
    let dailyAlpa = 0;
    let dailyBelum = 0;
    allDailyRowViews.forEach(r => {
      if (r.status === 'HADIR') dailyHadir++;
      else if (r.status === 'TERLAMBAT') dailyTerlambat++;
      else if (r.status === 'IZIN') dailyIzin++;
      else if (r.status === 'SAKIT') dailySakit++;
      else if (r.status === 'ALPA') dailyAlpa++;
      else dailyBelum++;
    });
    const dailyTotal = allDailyRowViews.length;
    const dailyAttended = dailyHadir + dailyTerlambat;
    const dailyRate = dailyTotal > 0 ? Math.round((dailyAttended / dailyTotal) * 100) : 0;

    // Filter baris detail berdasarkan status cetak
    const dailyRowViews = allDailyRowViews.filter(
      r => attPrintStatus === 'ALL' || r.status === attPrintStatus
    );

    // 2. RANGE MODE
    const rangeLogs = allAttendances.filter(a => a.date >= startDate && a.date <= endDate);
    const distinctLoggedDates = Array.from(new Set(rangeLogs.map(a => a.date))).sort();

    // Daftar semua tanggal kalender dalam rentang
    const rangeDateList: string[] = [];
    if (!isDaily && startDate && endDate) {
      try {
        const cur = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        let count = 0;
        while (cur <= end && count < 62) {
          rangeDateList.push(cur.toISOString().slice(0, 10));
          cur.setDate(cur.getDate() + 1);
          count++;
        }
      } catch {
        // fallback
      }
    }
    const datesToDisplay =
      rangeDateList.length > 0 ? rangeDateList : distinctLoggedDates.length > 0 ? distinctLoggedDates : [todayStr];

    const rangeEmployeeStats = targetEmployees.map(emp => {
      const empLogs = rangeLogs.filter(a => a.employeeId === emp.id);
      const hadir = empLogs.filter(a => a.status === 'HADIR').length;
      const terlambat = empLogs.filter(a => a.status === 'TERLAMBAT').length;
      const izin = empLogs.filter(a => a.status === 'IZIN').length;
      const sakit = empLogs.filter(a => a.status === 'SAKIT').length;
      const alpa = empLogs.filter(a => a.status === 'ALPA').length;
      const totalLoggedDays = empLogs.length;
      const totalHadir = hadir + terlambat;
      const totalPeriodDays = datesToDisplay.length || 1;
      const rate = Math.round((totalHadir / totalPeriodDays) * 100);

      return {
        employee: emp,
        totalLoggedDays,
        hadir,
        terlambat,
        izin,
        sakit,
        alpa,
        totalHadir,
        rate,
      };
    });

    let rangeTotalHadir = 0;
    let rangeTotalTerlambat = 0;
    let rangeTotalIzin = 0;
    let rangeTotalSakit = 0;
    let rangeTotalAlpa = 0;
    rangeEmployeeStats.forEach(stat => {
      rangeTotalHadir += stat.hadir;
      rangeTotalTerlambat += stat.terlambat;
      rangeTotalIzin += stat.izin;
      rangeTotalSakit += stat.sakit;
      rangeTotalAlpa += stat.alpa;
    });
    const totalPotentialOpportunities = targetEmployees.length * (datesToDisplay.length || 1);
    const rangeOverallRate =
      totalPotentialOpportunities > 0
        ? Math.round(((rangeTotalHadir + rangeTotalTerlambat) / totalPotentialOpportunities) * 100)
        : 0;

    return (
      <div id="print-attendance-sheet" className="bg-white font-sans text-slate-900 w-full text-xs">
        {/* Kop Surat Resmi Standar SPPG */}
        <div className="border-b-2 border-slate-900 pb-4 mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <SppgLogo size="lg" variant="color" showText={false} />
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">
                Satuan Pelayanan Pemenuhan Gizi (SPPG Jeru Tumpang)
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                SPPG Jeru Tumpang - Unit Pelayanan Dapur Gizi
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Jl. Pattimura No. 107, Dsn. Krajan, Ds. Jeru, Kec. Tumpang, Kab. Malang
              </p>
            </div>
          </div>

          <div className="text-right text-[11px] text-slate-500 space-y-0.5">
            <div>
              Tanggal Cetak: <span className="font-semibold text-slate-700">{printDate}</span>
            </div>
            <div>
              Operator: <span className="font-semibold text-slate-700">{currentUser?.name || 'Petugas SPPG'}</span>
            </div>
          </div>
        </div>

        {/* Judul Dokumen & Identitas Filter */}
        <div className="text-center my-4">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            {isDaily
              ? 'LAPORAN REKAPITULASI PRESENSI HARIAN KARYAWAN'
              : 'LAPORAN REKAPITULASI PRESENSI & KEHADIRAN KARYAWAN'}
          </h2>
          <div className="inline-flex flex-wrap items-center justify-center gap-2 mt-2 px-3 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200">
            {isDaily ? (
              <span>Hari & Tanggal: {getIndonesianDay(targetDate)}, {formatIndonesianDate(targetDate)}</span>
            ) : (
              <span>Periode: {formatIndonesianDate(startDate)} s/d {formatIndonesianDate(endDate)} ({datesToDisplay.length} hari)</span>
            )}
            <span>• Divisi: {attPrintDept === 'ALL' ? 'Semua Divisi' : attPrintDept}</span>
            {attPrintStatus !== 'ALL' && <span>• Status: {attPrintStatus}</span>}
            {searchQuery.trim() && <span>• Cari: &ldquo;{searchQuery}&rdquo;</span>}
          </div>
        </div>

        {/* Bagian A: Ringkasan Rekapitulasi Presensi per Divisi */}
        <div className="mb-6">
          <div className="font-bold text-xs text-slate-800 mb-2 flex items-center justify-between border-b border-slate-200 pb-1">
            <span>A. Rekapitulasi Presensi Berdasarkan Divisi / Departemen</span>
            <span className="text-[11px] font-normal text-slate-500">
              {isDaily ? 'Status kehadiran hari ini' : 'Akumulasi log kehadiran dalam periode'}
            </span>
          </div>

          <table className="w-full text-left text-xs border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold">
                <th className="py-2 px-2.5 border-r border-slate-300 text-center w-10">No</th>
                <th className="py-2 px-3 border-r border-slate-300">Departemen / Divisi</th>
                <th className="py-2 px-3 border-r border-slate-300 text-center w-24">Total Staf</th>
                <th className="py-2 px-3 border-r border-slate-300 text-center w-20">Hadir</th>
                <th className="py-2 px-3 border-r border-slate-300 text-center w-24">Terlambat</th>
                <th className="py-2 px-3 border-r border-slate-300 text-center w-20">Izin</th>
                <th className="py-2 px-3 border-r border-slate-300 text-center w-20">Sakit</th>
                <th className="py-2 px-3 border-r border-slate-300 text-center w-20">{isDaily ? 'Alpa / Blm' : 'Alpa'}</th>
                <th className="py-2 px-3 text-right w-28">Tingkat Hadir (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px]">
              {departmentsToRender.map((dept, idx) => {
                if (isDaily) {
                  const deptRows = dailyRowViews.filter(r => r.employee.department === dept);
                  const h = deptRows.filter(r => r.status === 'HADIR').length;
                  const t = deptRows.filter(r => r.status === 'TERLAMBAT').length;
                  const i = deptRows.filter(r => r.status === 'IZIN').length;
                  const s = deptRows.filter(r => r.status === 'SAKIT').length;
                  const a = deptRows.filter(r => r.status === 'ALPA' || r.status === 'BELUM_ABSEN').length;
                  const tot = deptRows.length;
                  const rate = tot > 0 ? Math.round(((h + t) / tot) * 100) : 0;

                  return (
                    <tr key={dept} className="hover:bg-slate-50">
                      <td className="py-2 px-2.5 border-r border-slate-300 text-center text-slate-500 font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-800">{dept}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-center font-mono">{tot}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-center font-mono text-emerald-700 font-semibold">{h}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-center font-mono text-amber-700">{t}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-center font-mono">{i}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-center font-mono">{s}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-center font-mono text-rose-700">{a}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{rate}%</td>
                    </tr>
                  );
                } else {
                  const deptEmps = rangeEmployeeStats.filter(e => e.employee.department === dept);
                  const h = deptEmps.reduce((acc, curr) => acc + curr.hadir, 0);
                  const t = deptEmps.reduce((acc, curr) => acc + curr.terlambat, 0);
                  const i = deptEmps.reduce((acc, curr) => acc + curr.izin, 0);
                  const s = deptEmps.reduce((acc, curr) => acc + curr.sakit, 0);
                  const a = deptEmps.reduce((acc, curr) => acc + curr.alpa, 0);
                  const totalDeptCapacity = deptEmps.length * (datesToDisplay.length || 1);
                  const rate = totalDeptCapacity > 0 ? Math.round(((h + t) / totalDeptCapacity) * 100) : 0;

                  return (
                    <tr key={dept} className="hover:bg-slate-50">
                      <td className="py-2 px-2.5 border-r border-slate-300 text-center text-slate-500 font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-800">{dept}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-center font-mono">{deptEmps.length}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-center font-mono text-emerald-700 font-semibold">{h}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-center font-mono text-amber-700">{t}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-center font-mono">{i}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-center font-mono">{s}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-center font-mono text-rose-700">{a}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{rate}%</td>
                    </tr>
                  );
                }
              })}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                <td colSpan={2} className="py-2 px-3 border-r border-slate-300 text-right">
                  Total Seluruh Divisi:
                </td>
                <td className="py-2 px-3 border-r border-slate-300 text-center font-mono">
                  {isDaily ? dailyTotal : targetEmployees.length}
                </td>
                <td className="py-2 px-3 border-r border-slate-300 text-center font-mono text-emerald-800">
                  {isDaily ? dailyHadir : rangeTotalHadir}
                </td>
                <td className="py-2 px-3 border-r border-slate-300 text-center font-mono text-amber-800">
                  {isDaily ? dailyTerlambat : rangeTotalTerlambat}
                </td>
                <td className="py-2 px-3 border-r border-slate-300 text-center font-mono">
                  {isDaily ? dailyIzin : rangeTotalIzin}
                </td>
                <td className="py-2 px-3 border-r border-slate-300 text-center font-mono">
                  {isDaily ? dailySakit : rangeTotalSakit}
                </td>
                <td className="py-2 px-3 border-r border-slate-300 text-center font-mono text-rose-800">
                  {isDaily ? dailyAlpa + dailyBelum : rangeTotalAlpa}
                </td>
                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">
                  {isDaily ? dailyRate : rangeOverallRate}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bagian B: Matriks Presensi Karyawan per Divisi */}
        <div className="space-y-6">
          <div className="font-bold text-xs text-slate-800 border-b border-slate-200 pb-1 flex items-center justify-between">
            <span>
              {isDaily
                ? 'B. Rincian Presensi Karyawan per Divisi Kerja'
                : 'B. Matriks Presensi & Kehadiran Harian Karyawan per Divisi'}
            </span>
            <span className="text-[11px] font-normal text-slate-500">
              {isDaily
                ? `Tanggal: ${formatIndonesianDate(targetDate)}`
                : `Rentang: ${formatIndonesianDate(startDate)} s/d ${formatIndonesianDate(endDate)} (${datesToDisplay.length} hari)`}
            </span>
          </div>

          {departmentsToRender.map((dept, deptIdx) => {
            if (isDaily) {
              const deptRows = dailyRowViews.filter(r => r.employee.department === dept);
              if (deptRows.length === 0) return null;

              return (
                <div key={dept} className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
                    <span className="text-slate-800">
                      {deptIdx + 1}. Divisi {dept} ({deptRows.length} Karyawan)
                    </span>
                    <span className="text-slate-600 text-[11px] font-medium">
                      Hadir: {deptRows.filter(r => r.status === 'HADIR' || r.status === 'TERLAMBAT').length} •
                      Izin/Sakit: {deptRows.filter(r => r.status === 'IZIN' || r.status === 'SAKIT').length} •
                      Alpa/Belum: {deptRows.filter(r => r.status === 'ALPA' || r.status === 'BELUM_ABSEN').length}
                    </span>
                  </div>

                  <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-300 text-slate-600 font-semibold">
                        <th className="py-1.5 px-2 border-r border-slate-300 text-center w-7">No</th>
                        <th className="py-1.5 px-2.5 border-r border-slate-300 font-mono w-24">NIP / ID</th>
                        <th className="py-1.5 px-3 border-r border-slate-300">Nama Karyawan</th>
                        <th className="py-1.5 px-2.5 border-r border-slate-300 w-32">Posisi / Jabatan</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 w-28">Shift</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 text-center w-24">Status Presensi</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 text-center font-mono w-16">Jam Masuk</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 text-center font-mono w-16">Jam Pulang</th>
                        <th className="py-1.5 px-3">Keterangan / Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {deptRows.map((row, rIdx) => {
                        const att = row.attendance;
                        const statusLabel =
                          row.status === 'HADIR'
                            ? '✓ Hadir'
                            : row.status === 'TERLAMBAT'
                            ? `T - Terlambat (${att?.lateMinutes || 0}m)`
                            : row.status === 'IZIN'
                            ? 'I - Izin'
                            : row.status === 'SAKIT'
                            ? 'S - Sakit'
                            : row.status === 'ALPA'
                            ? 'A - Alpa'
                            : '- Belum Absen';

                        const statusColor =
                          row.status === 'HADIR'
                            ? 'text-emerald-700 font-semibold'
                            : row.status === 'TERLAMBAT'
                            ? 'text-amber-700 font-semibold'
                            : row.status === 'IZIN' || row.status === 'SAKIT'
                            ? 'text-purple-700 font-medium'
                            : row.status === 'ALPA'
                            ? 'text-rose-700 font-bold'
                            : 'text-slate-400';

                        return (
                          <tr key={row.employee.id} className="hover:bg-slate-50/60">
                            <td className="py-1.5 px-2 border-r border-slate-300 text-center text-slate-400">{rIdx + 1}</td>
                            <td className="py-1.5 px-2.5 border-r border-slate-300 font-mono text-slate-700">{row.employee.nip}</td>
                            <td className="py-1.5 px-3 border-r border-slate-300 font-semibold text-slate-900">{row.employee.name}</td>
                            <td className="py-1.5 px-2.5 border-r border-slate-300 text-slate-700">{row.employee.position}</td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-slate-600 text-[9px]">{row.employee.shift}</td>
                            <td className={`py-1.5 px-2 border-r border-slate-300 text-center ${statusColor}`}>{statusLabel}</td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono text-slate-800">{att?.checkInTime || '-'}</td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono text-slate-800">{att?.checkOutTime || '-'}</td>
                            <td className="py-1.5 px-3 text-slate-600 truncate max-w-xs">{att?.notes || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            } else {
              const deptEmps = rangeEmployeeStats.filter(e => e.employee.department === dept);
              if (deptEmps.length === 0) return null;

              const totalDeptHadir = deptEmps.reduce((acc, c) => acc + c.hadir, 0);
              const totalDeptTerlambat = deptEmps.reduce((acc, c) => acc + c.terlambat, 0);
              const totalDeptIzin = deptEmps.reduce((acc, c) => acc + c.izin, 0);
              const totalDeptSakit = deptEmps.reduce((acc, c) => acc + c.sakit, 0);
              const totalDeptAlpa = deptEmps.reduce((acc, c) => acc + c.alpa, 0);
              const totalDeptCapacity = deptEmps.length * (datesToDisplay.length || 1);
              const deptRate =
                totalDeptCapacity > 0
                  ? Math.round(((totalDeptHadir + totalDeptTerlambat) / totalDeptCapacity) * 100)
                  : 0;

              return (
                <div key={dept} className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
                    <span className="text-slate-800">
                      {deptIdx + 1}. Divisi {dept} ({deptEmps.length} Personil)
                    </span>
                    <span className="text-slate-600 text-[11px] font-medium">
                      Periode: {formatIndonesianDate(startDate)} s/d {formatIndonesianDate(endDate)} ({datesToDisplay.length} hari) • Rata-rata Kehadiran: <strong className="text-emerald-800">{deptRate}%</strong>
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold">
                          <th rowSpan={2} className="py-1 px-1.5 border-r border-slate-300 text-center w-7">No</th>
                          <th rowSpan={2} className="py-1 px-2 border-r border-slate-300 font-mono w-20">NIP / ID</th>
                          <th rowSpan={2} className="py-1 px-2.5 border-r border-slate-300 min-w-[130px]">Nama Karyawan</th>
                          <th rowSpan={2} className="py-1 px-2 border-r border-slate-300 w-24">Jabatan</th>

                          {/* Header Kolom Tanggal-tanggal Presensi */}
                          <th colSpan={datesToDisplay.length} className="py-1 px-1 border-r border-slate-300 text-center bg-slate-100/90 font-bold text-slate-800">
                            Presensi Harian (Tanggal & Hari)
                          </th>

                          {/* Header Kolom Akumulasi Rekap */}
                          <th colSpan={6} className="py-1 px-1 text-center bg-slate-100/90 font-bold text-slate-800">
                            Akumulasi
                          </th>
                        </tr>
                        <tr className="bg-slate-50 border-b border-slate-300 text-[9px]">
                          {datesToDisplay.map(d => (
                            <th key={d} className="py-1 px-1 border-r border-slate-300 text-center font-mono min-w-[22px]">
                              <div className="text-[8px] text-slate-500 font-normal leading-tight">{getIndonesianShortDay(d)}</div>
                              <div className="font-bold text-slate-800 leading-tight">{d.slice(8, 10)}</div>
                            </th>
                          ))}
                          <th className="py-1 px-1 border-r border-slate-300 text-center w-7 text-emerald-700 font-bold" title="Total Hadir Tepat Waktu (H)">H</th>
                          <th className="py-1 px-1 border-r border-slate-300 text-center w-7 text-amber-700 font-bold" title="Total Terlambat (T)">T</th>
                          <th className="py-1 px-1 border-r border-slate-300 text-center w-7 text-sky-700 font-bold" title="Total Izin (I)">I</th>
                          <th className="py-1 px-1 border-r border-slate-300 text-center w-7 text-purple-700 font-bold" title="Total Sakit (S)">S</th>
                          <th className="py-1 px-1 border-r border-slate-300 text-center w-7 text-rose-700 font-bold" title="Total Alpa (A)">A</th>
                          <th className="py-1 px-1.5 text-right w-11 font-bold text-slate-900" title="Persentase Kehadiran">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {deptEmps.map((row, rIdx) => {
                          const emp = row.employee;
                          return (
                            <tr key={emp.id} className="hover:bg-slate-50/60">
                              <td className="py-1 px-1.5 border-r border-slate-300 text-center text-slate-400">{rIdx + 1}</td>
                              <td className="py-1 px-2 border-r border-slate-300 font-mono text-slate-700 text-[9px]">{emp.nip}</td>
                              <td className="py-1 px-2.5 border-r border-slate-300 font-semibold text-slate-900 whitespace-nowrap">{emp.name}</td>
                              <td className="py-1 px-2 border-r border-slate-300 text-slate-600 text-[9px] truncate max-w-[120px]">{emp.position}</td>

                              {/* Data Absen Per Hari untuk Karyawan */}
                              {datesToDisplay.map(dateStr => {
                                const log = rangeLogs.find(a => a.employeeId === emp.id && a.date === dateStr);
                                const status = log?.status;

                                if (status === 'HADIR') {
                                  return (
                                    <td
                                      key={dateStr}
                                      className="py-1 px-0.5 border-r border-slate-300 text-center font-bold text-emerald-700 bg-emerald-50/30 text-[11px]"
                                      title={`${emp.name} - ${dateStr}: Hadir (${log?.checkInTime || '-'})`}
                                    >
                                      ✓
                                    </td>
                                  );
                                }
                                if (status === 'TERLAMBAT') {
                                  return (
                                    <td
                                      key={dateStr}
                                      className="py-1 px-0.5 border-r border-slate-300 text-center font-bold text-amber-700 bg-amber-50/40 text-[10px]"
                                      title={`${emp.name} - ${dateStr}: Terlambat ${log?.lateMinutes || 0}m (${log?.checkInTime || '-'})`}
                                    >
                                      T
                                    </td>
                                  );
                                }
                                if (status === 'IZIN') {
                                  return (
                                    <td
                                      key={dateStr}
                                      className="py-1 px-0.5 border-r border-slate-300 text-center font-bold text-sky-700 bg-sky-50/40 text-[10px]"
                                      title={`${emp.name} - ${dateStr}: Izin (${log?.notes || '-'})`}
                                    >
                                      I
                                    </td>
                                  );
                                }
                                if (status === 'SAKIT') {
                                  return (
                                    <td
                                      key={dateStr}
                                      className="py-1 px-0.5 border-r border-slate-300 text-center font-bold text-purple-700 bg-purple-50/40 text-[10px]"
                                      title={`${emp.name} - ${dateStr}: Sakit (${log?.notes || '-'})`}
                                    >
                                      S
                                    </td>
                                  );
                                }
                                if (status === 'ALPA') {
                                  return (
                                    <td
                                      key={dateStr}
                                      className="py-1 px-0.5 border-r border-slate-300 text-center font-bold text-rose-700 bg-rose-50/40 text-[10px]"
                                      title={`${emp.name} - ${dateStr}: Alpa / Tanpa Keterangan`}
                                    >
                                      A
                                    </td>
                                  );
                                }
                                return (
                                  <td
                                    key={dateStr}
                                    className="py-1 px-0.5 border-r border-slate-300 text-center text-slate-300 text-[10px]"
                                    title={`${emp.name} - ${dateStr}: Belum Ada Data Presensi`}
                                  >
                                    -
                                  </td>
                                );
                              })}

                              {/* Kolom Total Akumulasi Karyawan */}
                              <td className="py-1 px-1 border-r border-slate-300 text-center font-mono text-emerald-700 font-bold">{row.hadir}</td>
                              <td className="py-1 px-1 border-r border-slate-300 text-center font-mono text-amber-700 font-bold">{row.terlambat}</td>
                              <td className="py-1 px-1 border-r border-slate-300 text-center font-mono text-sky-700 font-semibold">{row.izin}</td>
                              <td className="py-1 px-1 border-r border-slate-300 text-center font-mono text-purple-700 font-semibold">{row.sakit}</td>
                              <td className="py-1 px-1 border-r border-slate-300 text-center font-mono text-rose-700 font-bold">{row.alpa}</td>
                              <td className="py-1 px-1.5 text-right font-mono font-bold text-slate-900">{row.rate}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-[9px] text-slate-900">
                        <tr>
                          <td colSpan={4} className="py-1.5 px-2 border-r border-slate-300 text-right">
                            Total Hadir per Hari (✓ + T):
                          </td>
                          {datesToDisplay.map(dateStr => {
                            const hadirOnDate = deptEmps.filter(row => {
                              const log = rangeLogs.find(a => a.employeeId === row.employee.id && a.date === dateStr);
                              return log && (log.status === 'HADIR' || log.status === 'TERLAMBAT');
                            }).length;
                            return (
                              <td key={dateStr} className="py-1.5 px-0.5 border-r border-slate-300 text-center font-mono text-emerald-800">
                                {hadirOnDate > 0 ? hadirOnDate : '-'}
                              </td>
                            );
                          })}
                          <td className="py-1.5 px-1 border-r border-slate-300 text-center font-mono text-emerald-800">{totalDeptHadir}</td>
                          <td className="py-1.5 px-1 border-r border-slate-300 text-center font-mono text-amber-800">{totalDeptTerlambat}</td>
                          <td className="py-1.5 px-1 border-r border-slate-300 text-center font-mono text-sky-800">{totalDeptIzin}</td>
                          <td className="py-1.5 px-1 border-r border-slate-300 text-center font-mono text-purple-800">{totalDeptSakit}</td>
                          <td className="py-1.5 px-1 border-r border-slate-300 text-center font-mono text-rose-800">{totalDeptAlpa}</td>
                          <td className="py-1.5 px-1.5 text-right font-mono font-bold text-emerald-800">{deptRate}%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            }
          })}

          {/* Legenda Keterangan Simbol Presensi */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[10px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-slate-800">Keterangan Simbol Presensi:</span>
              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                <span className="font-bold text-xs">✓</span> Hadir Tepat Waktu
              </span>
              <span className="flex items-center gap-1 font-semibold text-amber-700">
                <span className="font-bold text-[11px]">T</span> Terlambat
              </span>
              <span className="flex items-center gap-1 font-semibold text-sky-700">
                <span className="font-bold text-[11px]">I</span> Izin
              </span>
              <span className="flex items-center gap-1 font-semibold text-purple-700">
                <span className="font-bold text-[11px]">S</span> Sakit
              </span>
              <span className="flex items-center gap-1 font-semibold text-rose-700">
                <span className="font-bold text-[11px]">A</span> Alpa / Tanpa Keterangan
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="font-bold text-[11px]">-</span> Libur / Belum Absen
              </span>
            </div>
            {!isDaily && (
              <div className="text-[9px] text-slate-500 italic">
                * Kolom H, T, I, S, A = Total akumulasi status presensi selama periode aktif
              </div>
            )}
          </div>
        </div>

        {/* Lembar Pengesahan Dokumen / Tanda Tangan */}
        <div className="pt-6 border-t border-slate-300 text-xs mt-8 print:mt-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-slate-500">Dibuat Oleh,</div>
              <div className="font-semibold text-slate-800">Petugas Presensi & Personalia</div>
              <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                ({currentUser?.name || 'Petugas SPPG'})
              </div>
            </div>

            <div>
              <div className="text-slate-500">Diverifikasi Oleh,</div>
              <div className="font-semibold text-slate-800">Koordinator Operasional Dapur</div>
              <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                (Budi Santoso, S.T)
              </div>
            </div>

            <div>
              <div className="text-slate-500">Mengetahui & Menyetujui,</div>
              <div className="font-semibold text-slate-800">Kepala SPPG Jeru Tumpang</div>
              <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                (Dr. Siti Rahma, M.M)
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // PRINTABLE SHEETS: LAPORAN DATA INDUK & MASTER KARYAWAN
  // -------------------------------------------------------------
  const renderPrintableEmployeesSheet = () => {
    // Filter employees according to empPrintDept, empPrintStatus, and empPrintSearch
    const targetEmployees = employees.filter(emp => {
      const matchSearch =
        !empPrintSearch.trim() ||
        emp.name.toLowerCase().includes(empPrintSearch.toLowerCase()) ||
        emp.nip.toLowerCase().includes(empPrintSearch.toLowerCase()) ||
        emp.position.toLowerCase().includes(empPrintSearch.toLowerCase()) ||
        emp.phone.toLowerCase().includes(empPrintSearch.toLowerCase());
      const matchDept = empPrintDept === 'ALL' || emp.department === empPrintDept;
      const matchStatus = empPrintStatus === 'ALL' || emp.status === empPrintStatus;
      return matchSearch && matchDept && matchStatus;
    });

    const totalStaff = targetEmployees.length;
    const activeStaff = targetEmployees.filter(e => e.status === 'AKTIF').length;
    const tetapStaff = targetEmployees.filter(e => e.employmentType === 'Tetap').length;
    const kontrakStaff = targetEmployees.filter(e => e.employmentType === 'Kontrak').length;
    const relawanStaff = targetEmployees.filter(e => e.employmentType === 'Relawan / Mitra Harian').length;

    // Departments to display
    const departmentsToRender =
      empPrintDept === 'ALL'
        ? DEPARTMENTS.filter(d => targetEmployees.some(e => e.department === d))
        : [empPrintDept as EmployeeDepartment];

    return (
      <div id="print-employees-sheet" className="bg-white font-sans text-slate-900 w-full text-xs">
        {/* Kop Surat Resmi Standar SPPG */}
        <div className="border-b-2 border-slate-900 pb-4 mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <SppgLogo size="lg" variant="color" showText={false} />
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">
                Satuan Pelayanan Pemenuhan Gizi (SPPG Jeru Tumpang)
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                SPPG Jeru Tumpang - Unit Pelayanan Dapur Gizi
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Jl. Pattimura No. 107, Dsn. Krajan, Ds. Jeru, Kec. Tumpang, Kab. Malang
              </p>
            </div>
          </div>

          <div className="text-right text-[11px] text-slate-500 space-y-0.5">
            <div>
              Tanggal Cetak: <span className="font-semibold text-slate-700">{printDate}</span>
            </div>
            <div>
              Operator: <span className="font-semibold text-slate-700">{currentUser?.name || 'Petugas SPPG'}</span>
            </div>
          </div>
        </div>

        {/* Judul Dokumen & Identitas Filter */}
        <div className="text-center my-4">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            LAPORAN DATA INDUK & MASTER KARYAWAN
          </h2>
          <div className="inline-flex flex-wrap items-center justify-center gap-2 mt-2 px-3 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200">
            <span>Per Tanggal: {printDate}</span>
            <span>• Filter Divisi: {empPrintDept === 'ALL' ? 'Semua Divisi' : empPrintDept}</span>
            <span>• Status: {empPrintStatus === 'ALL' ? 'Semua Status' : empPrintStatus}</span>
            {empPrintSearch.trim() && <span>• Cari: &ldquo;{empPrintSearch}&rdquo;</span>}
          </div>
        </div>

        {/* Bagian A: Ringkasan Distribusi Karyawan per Divisi */}
        <div className="mb-6">
          <div className="font-bold text-xs text-slate-800 mb-2 flex items-center justify-between border-b border-slate-200 pb-1">
            <span>A. Rekapitulasi Komposisi Personil per Divisi / Departemen</span>
            <span className="text-[11px] font-normal text-slate-500">
              Distribusi status kepegawaian
            </span>
          </div>

          <table className="w-full text-left text-xs border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold">
                <th className="py-2 px-2.5 border-r border-slate-300 text-center w-10">No</th>
                <th className="py-2 px-3 border-r border-slate-300">Departemen / Divisi</th>
                <th className="py-2 px-3 border-r border-slate-300 text-center w-24">Staf Tetap</th>
                <th className="py-2 px-3 border-r border-slate-300 text-center w-24">Staf Kontrak</th>
                <th className="py-2 px-3 border-r border-slate-300 text-center w-28">Mitra / Relawan</th>
                <th className="py-2 px-3 border-r border-slate-300 text-center w-24 font-bold">Total Staf</th>
                <th className="py-2 px-3 text-right w-24">Porsi (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px]">
              {departmentsToRender.map((dept, idx) => {
                const deptEmps = targetEmployees.filter(e => e.department === dept);
                const tetap = deptEmps.filter(e => e.employmentType === 'Tetap').length;
                const kontrak = deptEmps.filter(e => e.employmentType === 'Kontrak').length;
                const relawan = deptEmps.filter(e => e.employmentType === 'Relawan / Mitra Harian').length;
                const tot = deptEmps.length;
                const pct = totalStaff > 0 ? Math.round((tot / totalStaff) * 100) : 0;

                return (
                  <tr key={dept} className="hover:bg-slate-50">
                    <td className="py-2 px-2.5 border-r border-slate-300 text-center text-slate-500 font-mono">{idx + 1}</td>
                    <td className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-800">{dept}</td>
                    <td className="py-2 px-3 border-r border-slate-300 text-center font-mono">{tetap}</td>
                    <td className="py-2 px-3 border-r border-slate-300 text-center font-mono">{kontrak}</td>
                    <td className="py-2 px-3 border-r border-slate-300 text-center font-mono">{relawan}</td>
                    <td className="py-2 px-3 border-r border-slate-300 text-center font-mono font-bold text-slate-900 bg-slate-50">{tot}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">{pct}%</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                <td colSpan={2} className="py-2 px-3 border-r border-slate-300 text-right">
                  Total Akumulasi Personil:
                </td>
                <td className="py-2 px-3 border-r border-slate-300 text-center font-mono">{tetapStaff}</td>
                <td className="py-2 px-3 border-r border-slate-300 text-center font-mono">{kontrakStaff}</td>
                <td className="py-2 px-3 border-r border-slate-300 text-center font-mono">{relawanStaff}</td>
                <td className="py-2 px-3 border-r border-slate-300 text-center font-mono font-bold text-emerald-800 bg-emerald-50">{totalStaff}</td>
                <td className="py-2 px-3 text-right font-mono">100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bagian B: Rincian Data Karyawan per Divisi (Dipisahkan per Divisi) */}
        <div className="space-y-6">
          <div className="font-bold text-xs text-slate-800 border-b border-slate-200 pb-1">
            <span>B. Rincian Personil Berdasarkan Divisi Kerja</span>
          </div>

          {departmentsToRender.map((dept, deptIdx) => {
            const deptEmps = targetEmployees.filter(e => e.department === dept);
            if (deptEmps.length === 0) return null;

            return (
              <div key={dept} className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
                  <span className="text-slate-800">
                    {deptIdx + 1}. Divisi {dept} ({deptEmps.length} Personil)
                  </span>
                  <span className="text-slate-600 text-[11px] font-medium">
                    Tetap: {deptEmps.filter(e => e.employmentType === 'Tetap').length} •
                    Kontrak: {deptEmps.filter(e => e.employmentType === 'Kontrak').length} •
                    Relawan/Mitra: {deptEmps.filter(e => e.employmentType === 'Relawan / Mitra Harian').length}
                  </span>
                </div>

                <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-300 text-slate-600 font-semibold">
                      <th className="py-1.5 px-2 border-r border-slate-300 text-center w-7">No</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-300 font-mono w-24">NIP / ID</th>
                      <th className="py-1.5 px-3 border-r border-slate-300">Nama Lengkap</th>
                      <th className="py-1.5 px-2 border-r border-slate-300 text-center w-8">L/P</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-300 w-32">Jabatan / Posisi</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-300 w-28">Status Kerja</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-300 w-28">Shift Kerja</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-300 font-mono w-28">Kontak / HP</th>
                      <th className="py-1.5 px-3 border-r border-slate-300">Domisili</th>
                      <th className="py-1.5 px-2 text-center w-16">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deptEmps.map((emp, rIdx) => (
                      <tr key={emp.id} className="hover:bg-slate-50/60">
                        <td className="py-1.5 px-2 border-r border-slate-300 text-center text-slate-400">{rIdx + 1}</td>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 font-mono text-slate-700">{emp.nip}</td>
                        <td className="py-1.5 px-3 border-r border-slate-300 font-semibold text-slate-900">{emp.name}</td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono text-slate-600">{emp.gender}</td>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 text-slate-700">{emp.position}</td>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 text-slate-700">{emp.employmentType}</td>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 text-slate-600 text-[9px]">{emp.shift}</td>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 font-mono text-slate-700">{emp.phone || '-'}</td>
                        <td className="py-1.5 px-3 border-r border-slate-300 text-slate-600 truncate max-w-xs">{emp.address || '-'}</td>
                        <td className="py-1.5 px-2 text-center font-semibold">
                          {emp.status === 'AKTIF' ? (
                            <span className="text-emerald-700">Aktif</span>
                          ) : emp.status === 'CUTI' ? (
                            <span className="text-amber-700">Cuti</span>
                          ) : (
                            <span className="text-rose-700">Nonaktif</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {/* Lembar Pengesahan Dokumen / Tanda Tangan */}
        <div className="pt-6 border-t border-slate-300 text-xs mt-8 print:mt-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-slate-500">Dibuat Oleh,</div>
              <div className="font-semibold text-slate-800">Petugas Personalia / HRD</div>
              <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                ({currentUser?.name || 'Petugas SPPG'})
              </div>
            </div>

            <div>
              <div className="text-slate-500">Diverifikasi Oleh,</div>
              <div className="font-semibold text-slate-800">Koordinator Operasional SPPG</div>
              <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                (Budi Santoso, S.T)
              </div>
            </div>

            <div>
              <div className="text-slate-500">Mengetahui & Menyetujui,</div>
              <div className="font-semibold text-slate-800">Kepala SPPG Jeru Tumpang</div>
              <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                (Dr. Siti Rahma, M.M)
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Stylesheet cetak dokumen resmi SPPG */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-attendance-sheet, #print-attendance-sheet *,
          #print-employees-sheet, #print-employees-sheet * {
            visibility: visible;
          }
          #print-attendance-sheet,
          #print-employees-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 15px !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Konten Dashboard Utama (Disembunyikan saat mencetak) */}
      <div className="no-print space-y-5">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold shadow-2xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 bg-white p-5 rounded-2xl border shadow-xs">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Manajemen Karyawan & Presensi Kerja
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pusat data staf operasional dapur gizi, monitoring jam kerja, presensi harian, dan dokumentasi kehadiran.
            </p>
          </div>

          {/* Tab Switcher & Print Action */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('ATTENDANCE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'ATTENDANCE'
                    ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                Presensi Harian
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('EMPLOYEES')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'EMPLOYEES'
                    ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                Master Karyawan ({employees.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (activeTab === 'ATTENDANCE') {
                  setIsPrintAttendanceOpen(true);
                } else {
                  setIsPrintEmployeesOpen(true);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
              title={`Cetak Laporan ${activeTab === 'ATTENDANCE' ? 'Presensi' : 'Master Karyawan'}`}
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Cetak {activeTab === 'ATTENDANCE' ? 'Presensi' : 'Karyawan'}</span>
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

              {/* Cetak Rekap Presensi */}
              <button
                type="button"
                onClick={() => {
                  setAttPrintTargetDate(selectedDate);
                  setIsPrintAttendanceOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
                title="Cetak formulir dan rekapitulasi presensi karyawan"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Cetak Rekap Presensi</span>
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

              <button
                type="button"
                onClick={() => {
                  setEmpPrintDept(selectedDept);
                  setEmpPrintStatus(selectedStatus);
                  setEmpPrintSearch(searchQuery);
                  setIsPrintEmployeesOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
                title="Cetak berkas resmi data induk / master karyawan"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Cetak Master</span>
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
      </div>

      {/* =========================================================================
          MODAL 1: QUICK BATCH DAILY ATTENDANCE (1-CLICK CHECKLIST)
      ========================================================================= */}
      {isQuickModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto no-print">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto no-print">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto no-print">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs no-print">
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

      {/* =========================================================================
          MODAL 5: MODAL CETAK & PRATINJAU PRESENSI KARYAWAN
      ========================================================================= */}
      {isPrintAttendanceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto no-print">
          <div className="bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Printer className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Pratinjau Cetak Laporan Presensi Karyawan
                  </h3>
                  <p className="text-xs text-slate-500">
                    Satuan Pelayanan Pemenuhan Gizi (SPPG Jeru Tumpang) • Format resmi kop dinas & rekapitulasi per divisi
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak / Simpan PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintAttendanceOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Tutup pratinjau"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter & Kontrol Cetak Presensi */}
            <div className="px-6 py-3.5 bg-white border-b border-slate-200">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {/* Mode Cetak Toggle */}
                <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 font-semibold">
                  <button
                    type="button"
                    onClick={() => setAttPrintMode('DAILY')}
                    className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                      attPrintMode === 'DAILY'
                        ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Presensi Harian
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttPrintMode('RANGE')}
                    className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                      attPrintMode === 'RANGE'
                        ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Rekap Rentang Tanggal
                  </button>
                </div>

                <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                {/* Date Controls */}
                {attPrintMode === 'DAILY' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium">Tanggal:</span>
                    <input
                      type="date"
                      value={attPrintTargetDate}
                      onChange={e => setAttPrintTargetDate(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setAttPrintTargetDate(todayStr)}
                      className="px-2 py-1 text-[11px] font-semibold rounded border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                    >
                      Hari Ini
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-500 font-medium">Periode:</span>
                    <input
                      type="date"
                      value={attPrintStartDate}
                      onChange={e => setAttPrintStartDate(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-slate-400">s/d</span>
                    <input
                      type="date"
                      value={attPrintEndDate}
                      onChange={e => setAttPrintEndDate(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 6);
                        setAttPrintStartDate(d.toISOString().slice(0, 10));
                        setAttPrintEndDate(todayStr);
                      }}
                      className="px-2 py-1 text-[11px] font-semibold rounded border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                    >
                      7 Hari Terakhir
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                        setAttPrintStartDate(start);
                        setAttPrintEndDate(todayStr);
                      }}
                      className="px-2 py-1 text-[11px] font-semibold rounded border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                    >
                      Bulan Ini
                    </button>
                  </div>
                )}

                <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                {/* Filter Divisi */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">Divisi:</span>
                  <select
                    value={attPrintDept}
                    onChange={e => setAttPrintDept(e.target.value)}
                    className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="ALL">Semua Divisi (Pisah per Divisi)</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Status (Untuk Harian) */}
                {attPrintMode === 'DAILY' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-medium">Status:</span>
                    <select
                      value={attPrintStatus}
                      onChange={e => setAttPrintStatus(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="ALL">Semua Status</option>
                      <option value="HADIR">Hadir Tepat Waktu</option>
                      <option value="TERLAMBAT">Terlambat</option>
                      <option value="IZIN">Izin</option>
                      <option value="SAKIT">Sakit</option>
                      <option value="ALPA">Alpa</option>
                      <option value="BELUM_ABSEN">Belum Absen</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Area Pratinjau Kertas Cetak */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100">
              <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 sm:p-8 max-w-4xl mx-auto">
                {renderPrintableAttendanceSheet()}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Tips: Pada dialog cetak peramban, pilih &ldquo;Save as PDF&rdquo; untuk menyimpan arsip PDF atau langsung cetak ke printer fisik.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrintAttendanceOpen(false)}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / Cetak PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 6: MODAL CETAK & PRATINJAU MASTER KARYAWAN
      ========================================================================= */}
      {isPrintEmployeesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto no-print">
          <div className="bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Pratinjau Cetak Data Induk / Master Karyawan
                  </h3>
                  <p className="text-xs text-slate-500">
                    Satuan Pelayanan Pemenuhan Gizi (SPPG Jeru Tumpang) • Format resmi kop dinas & rincian per divisi
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak / Simpan PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintEmployeesOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Tutup pratinjau"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter & Kontrol Cetak Master Karyawan */}
            <div className="px-6 py-3.5 bg-white border-b border-slate-200">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {/* Filter Divisi */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">Divisi:</span>
                  <select
                    value={empPrintDept}
                    onChange={e => setEmpPrintDept(e.target.value)}
                    className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="ALL">Semua Divisi (Pisah per Divisi)</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Status Keaktifan */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <select
                    value={empPrintStatus}
                    onChange={e => setEmpPrintStatus(e.target.value)}
                    className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="AKTIF">Aktif</option>
                    <option value="CUTI">Cuti</option>
                    <option value="NONAKTIF">Nonaktif</option>
                  </select>
                </div>

                {/* Search Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">Cari:</span>
                  <input
                    type="text"
                    placeholder="Nama, NIP, posisi..."
                    value={empPrintSearch}
                    onChange={e => setEmpPrintSearch(e.target.value)}
                    className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44"
                  />
                  {empPrintSearch && (
                    <button
                      type="button"
                      onClick={() => setEmpPrintSearch('')}
                      className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Area Pratinjau Kertas Cetak */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100">
              <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 sm:p-8 max-w-4xl mx-auto">
                {renderPrintableEmployeesSheet()}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Tips: Pada dialog cetak peramban, pilih &ldquo;Save as PDF&rdquo; untuk menyimpan arsip PDF atau langsung cetak ke printer fisik.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrintEmployeesOpen(false)}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / Cetak PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CONTAINER CETAK TERSEMBUNYI (DITAMPILKAN KETIKA WINDOW.PRINT() DIPANGGIL)
      ========================================================================= */}
      <div className="hidden print:block">
        {isPrintEmployeesOpen || (!isPrintAttendanceOpen && activeTab === 'EMPLOYEES')
          ? renderPrintableEmployeesSheet()
          : renderPrintableAttendanceSheet()}
      </div>
    </div>
  );
};
