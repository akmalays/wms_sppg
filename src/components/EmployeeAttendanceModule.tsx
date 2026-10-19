import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SearchPicker } from './common/SearchPicker';
import { ActionDropdown } from './common/ActionDropdown';
import { Select } from './common/Select';
import { useConfirm } from '../context/ConfirmContext';
import { localDateIso } from '../utils/localDate';
import { KopText } from './common/KopText';
import { useAuth } from '../context/AuthContext';
import { warehouseDb, signerName, ATTENDANCE_PHOTO_RETENTION_DAYS } from '../db/storage';
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
  Layers,
  ArrowRight,
  FileText,
  ScanLine,
  QrCode,
} from 'lucide-react';
import { exportToExcel } from '../lib/excelExport';
import { PhotoUploadCompressor } from './PhotoUploadCompressor';
import { SppgLogo } from './SppgLogo';
import { UserAccountsPanel, ROLE_INFO } from './UserManagementModule';
import { AttendanceKiosk } from './AttendanceKiosk';
import { EmployeeQrDialog } from './EmployeeQrDialog';
import { AttendanceLocationDialog } from './AttendanceLocationDialog';
import { AttendancePosterDialog, AttendancePosterSheet, useAttendanceQr } from './AttendancePoster';
import { AttendanceGeofence, GEOFENCE_SETTING_KEY, isValidGeofence } from '../utils/attendanceAction';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, FIELD_INPUT, FIELD_LABEL, TABLE_INPUT, DialogShell, FormDialog } from './common/FormDialog';
import { WORK_SECTIONS, FLEXIBLE_SCHEDULE, parseSchedule, formatSchedule, lateMinutesFor, formatDuration } from '../utils/attendanceSchedule';

// Bagian kerja SPPG. Data lama dengan departemen lain tetap tampil apa adanya.
const DEPARTMENTS: EmployeeDepartment[] = [...WORK_SECTIONS];

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

// Helper nama hari singkatan (misal: "Sel" atau "Sl" jika padat)
const getIndonesianShortDay = (dateStr: string, veryDense = false): string => {
  if (!dateStr) return '';
  try {
    const days = veryDense
      ? ['Mn', 'Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb']
      : ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const d = new Date(dateStr + 'T00:00:00');
    return days[d.getDay()] || '';
  } catch {
    return '';
  }
};

type EmployeeTab = 'ATTENDANCE' | 'EMPLOYEES' | 'ACCOUNTS';

export const EmployeeAttendanceModule: React.FC<{ initialTab?: EmployeeTab }> = ({ initialTab }) => {
  const { currentUser, can } = useAuth();
  const askConfirm = useConfirm();
  const canManageUsers = can('MANAGE_USERS');

  // Absensi | Data karyawan | Akun aplikasi (khusus Superadmin & Kepala SPPG)
  const [activeTab, setActiveTab] = useState<EmployeeTab>(
    initialTab === 'ACCOUNTS' && !canManageUsers ? 'ATTENDANCE' : initialTab || 'ATTENDANCE'
  );

  // Selected Date for Attendance (Default to today in local YYYY-MM-DD)
  const todayStr = useMemo(() => localDateIso(), []);
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
    return localDateIso(d);
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

  // Hitung jumlah hari dalam rentang cetak
  const printRangeDaysCount = useMemo(() => {
    if (!attPrintStartDate || !attPrintEndDate) return 0;
    try {
      const s = new Date(attPrintStartDate + 'T00:00:00');
      const e = new Date(attPrintEndDate + 'T00:00:00');
      const diffTime = e.getTime() - s.getTime();
      return Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
    } catch {
      return 1;
    }
  }, [attPrintStartDate, attPrintEndDate]);


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
  // Muat ulang saat ada perubahan (termasuk absensi dari perangkat lain lewat realtime),
  // tanpa me-remount halaman agar dialog yang sedang diisi tidak tertutup.
  useEffect(() => {
    const onSync = () => setDataVersion(v => v + 1);
    window.addEventListener('sppg_storage_items_changed', onSync);
    return () => window.removeEventListener('sppg_storage_items_changed', onSync);
  }, []);
  const refreshData = () => setDataVersion(v => v + 1);

  // Load Data from Database
  const employees = useMemo(() => warehouseDb.getEmployees(), [dataVersion]);
  // Akun aplikasi yang ditautkan ke karyawan, untuk penanda di tabel karyawan.
  const appUsers = useMemo(() => warehouseDb.getUsers(), [dataVersion, activeTab]);
  const accountByEmployee = useMemo(
    () => new Map(appUsers.filter(u => u.employeeId).map(u => [u.employeeId as string, u])),
    [appUsers]
  );
  const allAttendances = useMemo(() => warehouseDb.getAttendanceLogs(), [dataVersion]);

  // Bagian kerja baru + departemen lama yang masih dipakai karyawan, agar data lama tetap muncul
  // di filter dan laporan (bukan hilang karena tidak cocok dengan daftar bagian baru).
  const departmentOptions = useMemo<EmployeeDepartment[]>(() => {
    const extra = Array.from(new Set(employees.map(e => e.department))).filter(d => d && !DEPARTMENTS.includes(d));
    return [...DEPARTMENTS, ...extra.sort()];
  }, [employees]);

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
      /** BELUM = belum absen dan tidak disimpan. */
      status: AttendanceStatus | 'BELUM';
      checkInTime: string;
      lateMinutes: number;
      notes: string;
      /** Diubah di form ini; hanya baris yang diubah yang disimpan. */
      dirty: boolean;
    }>
  >([]);

  // Isi manual untuk pengecualian. Karyawan yang belum absen dibiarkan "Belum absen" (tidak dianggap hadir),
  // dan hanya baris yang diubah yang disimpan, agar absen dari HP tidak tertimpa.
  const handleOpenQuickAttendance = () => {
    const rows = activeEmployees.map(emp => {
      const existing = attendancesForDate.find(a => a.employeeId === emp.id);
      return {
        employeeId: emp.id,
        name: emp.name,
        department: emp.department,
        position: emp.position,
        shift: emp.shift,
        status: existing ? existing.status : ('BELUM' as const),
        checkInTime: existing ? existing.checkInTime : '',
        lateMinutes: existing ? (existing.lateMinutes || 0) : 0,
        notes: existing ? (existing.notes || '') : '',
        dirty: false,
      };
    });
    setQuickRows(rows);
    setIsQuickModalOpen(true);
  };

  const updateQuickRow = (idx: number, patch: Partial<(typeof quickRows)[number]>) =>
    setQuickRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch, dirty: true } : r)));

  const quickDirtyCount = quickRows.filter(r => r.dirty && r.status !== 'BELUM').length;

  const handleSaveQuickAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    const changed = quickRows.filter(r => r.dirty && r.status !== 'BELUM');
    if (changed.length === 0) {
      setIsQuickModalOpen(false);
      return;
    }
    const entries = changed.map(row => ({
      date: selectedDate,
      employeeId: row.employeeId,
      employeeName: row.name,
      department: row.department,
      position: row.position,
      shift: row.shift,
      checkInTime: row.status === 'IZIN' || row.status === 'SAKIT' || row.status === 'ALPA' ? '' : row.checkInTime,
      status: row.status as AttendanceStatus,
      lateMinutes: row.status === 'TERLAMBAT' ? Number(row.lateMinutes || 0) : 0,
      notes: row.notes,
      recordedBy: currentUser.name,
      verified: true,
    }));

    warehouseDb.recordBatchAttendance(entries, currentUser);
    refreshData();
    setIsQuickModalOpen(false);
    showToast(`Presensi ${entries.length} karyawan tersimpan untuk tanggal ${selectedDate}.`);
  };

  // 2. Single Attendance Modal (Add or Edit individual attendance)
  const [isSingleAttModalOpen, setIsSingleAttModalOpen] = useState(false);
  const [singleAttEmpId, setSingleAttEmpId] = useState('');
  const [singleAttDate, setSingleAttDate] = useState(selectedDate);
  const [singleAttCheckIn, setSingleAttCheckIn] = useState('05:00');
  const [singleAttCheckOut, setSingleAttCheckOut] = useState('');
  const [singleAttStatus, setSingleAttStatus] = useState<AttendanceStatus>('HADIR');
  const [singleAttNotes, setSingleAttNotes] = useState('');
  const [singleAttPhotos, setSingleAttPhotos] = useState<string[]>([]);
  // Foto hanya dikirim ulang bila diubah di form; selain itu foto di database dibiarkan
  const [singleAttPhotoTouched, setSingleAttPhotoTouched] = useState(false);

  // Foto absen tidak ikut dimuat saat sinkron; diambil dari database saat dibuka
  const [loadingPhotoId, setLoadingPhotoId] = useState<string | null>(null);
  const photoCutoff = localDateIso(new Date(Date.now() - ATTENDANCE_PHOTO_RETENTION_DAYS * 86400000));
  const attendanceMayHavePhoto = (a: EmployeeAttendance) => Boolean(a.photoUrl) || (a.date >= photoCutoff && Boolean(a.checkInTime));
  const handleViewPhoto = async (a: EmployeeAttendance) => {
    setLoadingPhotoId(a.id);
    try {
      const url = await warehouseDb.getAttendancePhoto(a.id);
      if (url) setPhotoPreviewUrl(url);
      else showToast(`Tidak ada foto absen untuk ${a.employeeName} di tanggal ini.`);
    } catch {
      showToast('Foto gagal dimuat. Periksa koneksi lalu coba lagi.');
    } finally {
      setLoadingPhotoId(null);
    }
  };

  const handleOpenSingleAtt = (emp?: Employee, existingAtt?: EmployeeAttendance) => {
    const targetEmp = emp || activeEmployees[0];
    if (!targetEmp) {
      alert('Belum ada data staf yang terdaftar.');
      return;
    }

    setSingleAttEmpId(targetEmp.id);
    setSingleAttDate(selectedDate);
    setSingleAttPhotoTouched(false);

    if (existingAtt) {
      setSingleAttCheckIn(existingAtt.checkInTime || '');
      setSingleAttCheckOut(existingAtt.checkOutTime || '');
      setSingleAttStatus(existingAtt.status);
      setSingleAttNotes(existingAtt.notes || '');
      setSingleAttPhotos(existingAtt.photoUrl ? [existingAtt.photoUrl] : []);
      if (!existingAtt.photoUrl && attendanceMayHavePhoto(existingAtt)) {
        warehouseDb
          .getAttendancePhoto(existingAtt.id)
          .then(url => url && setSingleAttPhotos(prev => (prev.length ? prev : [url])))
          .catch(() => undefined);
      }
    } else {
      setSingleAttCheckIn('');
      setSingleAttCheckOut('');
      setSingleAttStatus('HADIR');
      setSingleAttNotes('');
      setSingleAttPhotos([]);
    }

    setIsSingleAttModalOpen(true);
  };

  // Terlambat dihitung dari jam kerja karyawan terpilih (bukan diketik), sama seperti absen dari HP
  const singleAttSchedule = parseSchedule(employees.find(e => e.id === singleAttEmpId)?.shift);
  const singleAttLate = singleAttCheckIn ? lateMinutesFor(singleAttCheckIn, singleAttSchedule) : 0;

  const handleSaveSingleAtt = (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmp = employees.find(e => e.id === singleAttEmpId);
    if (!targetEmp) return;
    const present = singleAttStatus === 'HADIR' || singleAttStatus === 'TERLAMBAT';

    warehouseDb.recordAttendance(
      {
        date: singleAttDate,
        employeeId: targetEmp.id,
        employeeName: targetEmp.name,
        department: targetEmp.department,
        position: targetEmp.position,
        shift: targetEmp.shift,
        checkInTime: present ? singleAttCheckIn : '',
        checkOutTime: present ? singleAttCheckOut : '',
        status: present ? (singleAttLate > 0 ? 'TERLAMBAT' : 'HADIR') : singleAttStatus,
        lateMinutes: present ? singleAttLate : 0,
        photoUrl: singleAttPhotoTouched ? singleAttPhotos[0] || '' : undefined,
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

  // Absen mandiri dari HP: poster QR lobby dan lokasi absen (geofence).
  // Mode pindai QR karyawan dan QR pribadi tetap ada sebagai cadangan.
  const [isKioskOpen, setIsKioskOpen] = useState(false);
  const [qrEmployee, setQrEmployee] = useState<Employee | null>(null);
  const [isPosterOpen, setIsPosterOpen] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [geofenceVersion, setGeofenceVersion] = useState(0);
  const posterQr = useAttendanceQr();
  const geofence = useMemo(
    () => warehouseDb.getAppSetting<AttendanceGeofence | null>(GEOFENCE_SETTING_KEY, null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geofenceVersion, dataVersion]
  );
  const hasGeofence = isValidGeofence(geofence);

  // 3. Employee Master Modal (Add or Edit Employee)
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [empName, setEmpName] = useState('');
  const [empNik, setEmpNik] = useState('');
  const [empNip, setEmpNip] = useState('');
  const [empGender, setEmpGender] = useState<'L' | 'P'>('L');
  const [empPhone, setEmpPhone] = useState('');
  const [empDept, setEmpDept] = useState<EmployeeDepartment>('Pengolahan');
  const [empPosition, setEmpPosition] = useState('');
  const [empEmploymentType, setEmpEmploymentType] = useState<EmploymentType>('Kontrak');
  // Jam kerja: "HH:MM - HH:MM" atau "Fleksibel" (lihat utils/attendanceSchedule)
  const [empShift, setEmpShift] = useState<EmployeeShift>('05:00 - 13:00');
  const empSchedule = parseSchedule(empShift);
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
    setEmpDept('Pengolahan');
    setEmpPosition('');
    setEmpEmploymentType('Kontrak');
    setEmpShift('05:00 - 13:00');
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
    // Format lama ("Pagi (05:00 - 13:00)") dibaca lalu disimpan ulang dalam format baru
    setEmpShift(formatSchedule(parseSchedule(emp.shift)));
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

  const handleDeleteEmployee = async (emp: Employee) => {
    if (await askConfirm({
      title: `Hapus data ${emp.name}?`,
      message: `NIP ${emp.nip}. Data karyawan yang dihapus tidak bisa dikembalikan.`,
      confirmText: 'Hapus karyawan',
      variant: 'danger',
    })) {
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
      'Bagian': row.employee.department,
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
      `Rekap_Presensi_SPPG_MLG_TUMPANG_JERU_${selectedDate}.xlsx`,
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
      'Bagian': emp.department,
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
      `Master_Data_Karyawan_SPPG_MLG_TUMPANG_JERU_${todayStr}.xlsx`,
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap bg-slate-100 text-slate-700 border border-slate-200">
            Belum absen
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
        ? departmentOptions.filter(d => targetEmployees.some(e => e.department === d))
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
          rangeDateList.push(localDateIso(cur));
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
            <KopText />
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
            <span>• Bagian: {attPrintDept === 'ALL' ? 'Semua bagian' : attPrintDept}</span>
            {attPrintStatus !== 'ALL' && <span>• Status: {attPrintStatus}</span>}
            {searchQuery.trim() && <span>• Cari: &ldquo;{searchQuery}&rdquo;</span>}
          </div>
        </div>

        {/* Bagian A: Ringkasan Rekapitulasi Presensi per Divisi */}
        <div className="mb-6">
          <div className="font-bold text-xs text-slate-800 mb-2 flex items-center justify-between border-b border-slate-200 pb-1">
            <span>A. Rekapitulasi Presensi per Bagian</span>
            <span className="text-[11px] font-normal text-slate-500">
              {isDaily ? 'Status kehadiran hari ini' : 'Akumulasi log kehadiran dalam periode'}
            </span>
          </div>

          <table className="w-full text-left text-xs border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold">
                <th className="py-2 px-2.5 border-r border-slate-300 text-center w-10">No</th>
                <th className="py-2 px-3 border-r border-slate-300">Bagian</th>
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
                  Total semua bagian:
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
                ? 'B. Rincian Presensi Karyawan per Bagian'
                : 'B. Kehadiran Harian Karyawan per Bagian'}
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
                      {deptIdx + 1}. {dept} ({deptRows.length} karyawan)
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

              const totalDays = datesToDisplay.length;
              const isDense = totalDays > 14;
              const isVeryDense = totalDays > 22;

              return (
                <div key={dept} className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
                    <span className="text-slate-800">
                      {deptIdx + 1}. {dept} ({deptEmps.length} karyawan)
                    </span>
                    <span className="text-slate-600 text-[11px] font-medium">
                      Periode: {formatIndonesianDate(startDate)} s/d {formatIndonesianDate(endDate)} ({datesToDisplay.length} hari) • Rata-rata Kehadiran: <strong className="text-emerald-800">{deptRate}%</strong>
                    </span>
                  </div>

                  <div className="overflow-x-auto print:overflow-visible">
                    <table className={`w-full text-left border border-slate-300 border-collapse table-fixed ${isVeryDense ? 'text-[8.5px]' : isDense ? 'text-[9px]' : 'text-[10px]'}`}>
                      <colgroup>
                        <col style={{ width: isVeryDense ? '22px' : '26px' }} />
                        <col style={{ width: isVeryDense ? '54px' : '65px' }} />
                        <col style={{ width: isVeryDense ? '105px' : '125px' }} />
                        <col style={{ width: isVeryDense ? '70px' : '85px' }} />
                        {datesToDisplay.map(d => (
                          <col key={d} />
                        ))}
                        <col style={{ width: isVeryDense ? '18px' : '22px' }} />
                        <col style={{ width: isVeryDense ? '18px' : '22px' }} />
                        <col style={{ width: isVeryDense ? '18px' : '22px' }} />
                        <col style={{ width: isVeryDense ? '18px' : '22px' }} />
                        <col style={{ width: isVeryDense ? '18px' : '22px' }} />
                        <col style={{ width: isVeryDense ? '28px' : '34px' }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold">
                          <th rowSpan={2} className="py-1 px-0.5 border-r border-slate-300 text-center">No</th>
                          <th rowSpan={2} className="py-1 px-1 border-r border-slate-300 font-mono">NIP</th>
                          <th rowSpan={2} className="py-1 px-1.5 border-r border-slate-300">Nama Karyawan</th>
                          <th rowSpan={2} className="py-1 px-1 border-r border-slate-300">Jabatan</th>

                          {/* Header Kolom Tanggal-tanggal Presensi */}
                          <th colSpan={datesToDisplay.length} className="py-1 px-0.5 border-r border-slate-300 text-center bg-slate-100/90 font-bold text-slate-800">
                            Presensi Harian (Tanggal & Hari)
                          </th>

                          {/* Header Kolom Akumulasi Rekap */}
                          <th colSpan={6} className="py-1 px-0.5 text-center bg-slate-100/90 font-bold text-slate-800">
                            Akumulasi
                          </th>
                        </tr>
                        <tr className="bg-slate-50 border-b border-slate-300 text-[9px]">
                          {datesToDisplay.map(d => (
                            <th key={d} className="py-1 px-0.5 border-r border-slate-300 text-center font-mono">
                              <div className={`${isVeryDense ? 'text-[7px]' : 'text-[8px]'} text-slate-500 font-normal leading-none`}>
                                {getIndonesianShortDay(d, isVeryDense)}
                              </div>
                              <div className={`font-bold text-slate-800 leading-tight ${isVeryDense ? 'text-[8px]' : 'text-[9px]'}`}>
                                {d.slice(8, 10)}
                              </div>
                            </th>
                          ))}
                          <th className="py-1 px-0.5 border-r border-slate-300 text-center text-emerald-700 font-bold text-[8px]" title="Hadir Tepat Waktu (H)">H</th>
                          <th className="py-1 px-0.5 border-r border-slate-300 text-center text-amber-700 font-bold text-[8px]" title="Terlambat (T)">T</th>
                          <th className="py-1 px-0.5 border-r border-slate-300 text-center text-sky-700 font-bold text-[8px]" title="Izin (I)">I</th>
                          <th className="py-1 px-0.5 border-r border-slate-300 text-center text-purple-700 font-bold text-[8px]" title="Sakit (S)">S</th>
                          <th className="py-1 px-0.5 border-r border-slate-300 text-center text-rose-700 font-bold text-[8px]" title="Alpa (A)">A</th>
                          <th className="py-1 px-0.5 text-right font-bold text-slate-900 text-[8px]" title="Persentase Kehadiran (%)">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {deptEmps.map((row, rIdx) => {
                          const emp = row.employee;
                          return (
                            <tr key={emp.id} className="hover:bg-slate-50/60">
                              <td className="py-1 px-0.5 border-r border-slate-300 text-center text-slate-400 text-[8px]">{rIdx + 1}</td>
                              <td className="py-1 px-0.5 border-r border-slate-300 font-mono text-slate-700 text-[8px] truncate" title={emp.nip}>{emp.nip}</td>
                              <td className="py-1 px-1.5 border-r border-slate-300 font-semibold text-slate-900 truncate" title={emp.name}>{emp.name}</td>
                              <td className="py-1 px-1 border-r border-slate-300 text-slate-600 text-[8px] truncate" title={emp.position}>{emp.position}</td>

                              {/* Data Absen Per Hari untuk Karyawan */}
                              {datesToDisplay.map(dateStr => {
                                const log = rangeLogs.find(a => a.employeeId === emp.id && a.date === dateStr);
                                const status = log?.status;

                                if (status === 'HADIR') {
                                  return (
                                    <td
                                      key={dateStr}
                                      className="py-0.5 px-0 border-r border-slate-300 text-center font-bold text-emerald-700 bg-emerald-50/30 text-[9.5px]"
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
                                      className="py-0.5 px-0 border-r border-slate-300 text-center font-bold text-amber-700 bg-amber-50/40 text-[9px]"
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
                                      className="py-0.5 px-0 border-r border-slate-300 text-center font-bold text-sky-700 bg-sky-50/40 text-[9px]"
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
                                      className="py-0.5 px-0 border-r border-slate-300 text-center font-bold text-purple-700 bg-purple-50/40 text-[9px]"
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
                                      className="py-0.5 px-0 border-r border-slate-300 text-center font-bold text-rose-700 bg-rose-50/40 text-[9px]"
                                      title={`${emp.name} - ${dateStr}: Alpa / Tanpa Keterangan`}
                                    >
                                      A
                                    </td>
                                  );
                                }
                                return (
                                  <td
                                    key={dateStr}
                                    className="py-0.5 px-0 border-r border-slate-300 text-center text-slate-300 text-[9px]"
                                    title={`${emp.name} - ${dateStr}: Belum Ada Data Presensi`}
                                  >
                                    -
                                  </td>
                                );
                              })}

                              {/* Kolom Total Akumulasi Karyawan */}
                              <td className="py-1 px-0.5 border-r border-slate-300 text-center font-mono text-emerald-700 font-bold text-[8px]">{row.hadir}</td>
                              <td className="py-1 px-0.5 border-r border-slate-300 text-center font-mono text-amber-700 font-bold text-[8px]">{row.terlambat}</td>
                              <td className="py-1 px-0.5 border-r border-slate-300 text-center font-mono text-sky-700 font-semibold text-[8px]">{row.izin}</td>
                              <td className="py-1 px-0.5 border-r border-slate-300 text-center font-mono text-purple-700 font-semibold text-[8px]">{row.sakit}</td>
                              <td className="py-1 px-0.5 border-r border-slate-300 text-center font-mono text-rose-700 font-bold text-[8px]">{row.alpa}</td>
                              <td className="py-1 px-0.5 text-right font-mono font-bold text-slate-900 text-[8px]">{row.rate}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-[8px] text-slate-900">
                        <tr>
                          <td colSpan={4} className="py-1.5 px-1.5 border-r border-slate-300 text-right">
                            Total Hadir per Hari (✓ + T):
                          </td>
                          {datesToDisplay.map(dateStr => {
                            const hadirOnDate = deptEmps.filter(row => {
                              const log = rangeLogs.find(a => a.employeeId === row.employee.id && a.date === dateStr);
                              return log && (log.status === 'HADIR' || log.status === 'TERLAMBAT');
                            }).length;
                            return (
                              <td key={dateStr} className="py-1.5 px-0 border-r border-slate-300 text-center font-mono text-emerald-800">
                                {hadirOnDate > 0 ? hadirOnDate : '-'}
                              </td>
                            );
                          })}
                          <td className="py-1.5 px-0.5 border-r border-slate-300 text-center font-mono text-emerald-800">{totalDeptHadir}</td>
                          <td className="py-1.5 px-0.5 border-r border-slate-300 text-center font-mono text-amber-800">{totalDeptTerlambat}</td>
                          <td className="py-1.5 px-0.5 border-r border-slate-300 text-center font-mono text-sky-800">{totalDeptIzin}</td>
                          <td className="py-1.5 px-0.5 border-r border-slate-300 text-center font-mono text-purple-800">{totalDeptSakit}</td>
                          <td className="py-1.5 px-0.5 border-r border-slate-300 text-center font-mono text-rose-800">{totalDeptAlpa}</td>
                          <td className="py-1.5 px-0.5 text-right font-mono text-emerald-800 font-bold">{deptRate}%</td>
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
                ({signerName('KOORDINATOR')})
              </div>
            </div>

            <div>
              <div className="text-slate-500">Mengetahui & Menyetujui,</div>
              <div className="font-semibold text-slate-800">Kepala SPPG Tumpang Jeru</div>
              <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                ({signerName('KEPALA_SPPG')})
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
        ? departmentOptions.filter(d => targetEmployees.some(e => e.department === d))
        : [empPrintDept as EmployeeDepartment];

    return (
      <div id="print-employees-sheet" className="bg-white font-sans text-slate-900 w-full text-xs">
        {/* Kop Surat Resmi Standar SPPG */}
        <div className="border-b-2 border-slate-900 pb-4 mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <SppgLogo size="lg" variant="color" showText={false} />
            <KopText />
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
            <span>• Bagian: {empPrintDept === 'ALL' ? 'Semua bagian' : empPrintDept}</span>
            <span>• Status: {empPrintStatus === 'ALL' ? 'Semua Status' : empPrintStatus}</span>
            {empPrintSearch.trim() && <span>• Cari: &ldquo;{empPrintSearch}&rdquo;</span>}
          </div>
        </div>

        {/* Bagian A: Ringkasan Distribusi Karyawan per Divisi */}
        <div className="mb-6">
          <div className="font-bold text-xs text-slate-800 mb-2 flex items-center justify-between border-b border-slate-200 pb-1">
            <span>A. Jumlah Karyawan per Bagian</span>
            <span className="text-[11px] font-normal text-slate-500">
              Distribusi status kepegawaian
            </span>
          </div>

          <table className="w-full text-left text-xs border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold">
                <th className="py-2 px-2.5 border-r border-slate-300 text-center w-10">No</th>
                <th className="py-2 px-3 border-r border-slate-300">Bagian</th>
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
            <span>B. Rincian Karyawan per Bagian</span>
          </div>

          {departmentsToRender.map((dept, deptIdx) => {
            const deptEmps = targetEmployees.filter(e => e.department === dept);
            if (deptEmps.length === 0) return null;

            return (
              <div key={dept} className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
                  <span className="text-slate-800">
                    {deptIdx + 1}. {dept} ({deptEmps.length} karyawan)
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
                ({signerName('KOORDINATOR')})
              </div>
            </div>

            <div>
              <div className="text-slate-500">Mengetahui & Menyetujui,</div>
              <div className="font-semibold text-slate-800">Kepala SPPG Tumpang Jeru</div>
              <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                ({signerName('KEPALA_SPPG')})
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
          @page {
            size: ${!isPosterOpen && attPrintMode === 'RANGE' ? 'A4 landscape' : 'A4 portrait'};
            margin: ${!isPosterOpen && attPrintMode === 'RANGE' ? '5mm 6mm' : '8mm 10mm'};
          }
          body * {
            visibility: hidden;
          }
          #print-attendance-sheet, #print-attendance-sheet *,
          #print-employees-sheet, #print-employees-sheet *,
          #print-attendance-poster, #print-attendance-poster * {
            visibility: visible;
          }
          #print-attendance-sheet,
          #print-employees-sheet,
          #print-attendance-poster {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
            box-sizing: border-box !important;
          }
          .overflow-x-auto {
            overflow: visible !important;
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
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Karyawan</h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Absensi harian, data karyawan{canManageUsers ? ', dan akun untuk masuk ke aplikasi' : ''}.
            </p>
          </div>
          <div role="tablist" aria-label="Bagian" className="inline-flex p-1 rounded-lg bg-slate-200/70 text-xs self-start overflow-x-auto max-w-full">
            {([
              { id: 'ATTENDANCE', label: 'Absensi' },
              { id: 'EMPLOYEES', label: `Data karyawan (${employees.length})` },
              ...(canManageUsers ? [{ id: 'ACCOUNTS', label: `Akun aplikasi (${appUsers.length})` }] : []),
            ] as { id: EmployeeTab; label: string }[]).map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 min-h-[44px] sm:min-h-[30px] rounded-md whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  activeTab === t.id ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-700 hover:text-slate-900 font-medium'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

      {/* =========================================================================
          TAB 1: PRESENSI & ABSENSI HARIAN
      ========================================================================= */}
      {activeTab === 'ATTENDANCE' && (
        <div className="space-y-4">
          {/* Absen dari HP tidak bisa dipakai sebelum lokasi SPPG diatur */}
          {!hasGeofence && (
            <div role="note" className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900">
              <span>
                <b>Lokasi absen belum diatur.</b> Karyawan belum bisa absen dari HP. Atur titik SPPG sambil berdiri di lobby, lalu cetak QR lobby.
              </span>
              <button type="button" onClick={() => setIsLocationOpen(true)} className={`${BTN_PRIMARY} shrink-0`}>
                Atur lokasi absen
              </button>
            </div>
          )}
          {/* KPI Kehadiran Harian (Sederhana & Rapi 4 Metrik) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            <div className="pt-2 sm:pt-0 sm:px-3 first:px-0">
              <span className="text-[11px] font-medium text-slate-500">Total Karyawan</span>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">
                {metrics.total} <span className="text-xs font-normal text-slate-500">Staf</span>
              </div>
              <span className="text-[10px] text-slate-400">Karyawan aktif</span>
            </div>

            <div className="pt-2 sm:pt-0 sm:px-4">
              <span className="text-[11px] font-medium text-emerald-700">Hadir Hari Ini</span>
              <div className="text-xl sm:text-2xl font-bold text-emerald-800 mt-0.5 tabular-nums">
                {metrics.hadir}{' '}
                <span className="text-xs font-medium text-emerald-600">({metrics.rate}%)</span>
              </div>
              <span className="text-[10px] text-slate-400">
                {metrics.terlambat > 0 ? `${metrics.terlambat} terlambat` : metrics.hadir > 0 ? 'Tidak ada yang terlambat' : 'Belum ada yang hadir'}
              </span>
            </div>

            <div className="pt-2 sm:pt-0 sm:px-4">
              <span className="text-[11px] font-medium text-amber-700">Izin & Sakit</span>
              <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-0.5 tabular-nums">
                {metrics.izin + metrics.sakit}{' '}
                <span className="text-xs font-normal text-slate-500">Staf</span>
              </div>
              <span className="text-[10px] text-slate-400">
                Izin: {metrics.izin} • Sakit: {metrics.sakit}
              </span>
            </div>

            <div className="pt-2 sm:pt-0 sm:px-4">
              <span className="text-[11px] font-medium text-rose-700">Belum Hadir / Alpa</span>
              <div className="text-xl sm:text-2xl font-bold text-rose-800 mt-0.5 tabular-nums">
                {metrics.alpa + metrics.belumAbsen}{' '}
                <span className="text-xs font-normal text-slate-500">Staf</span>
              </div>
              <span className="text-[10px] text-slate-400">
                Alpa: {metrics.alpa} • Belum Absen: {metrics.belumAbsen}
              </span>
            </div>
          </div>

          {/* Action & Filter Toolbar (Sederhana, Bersih & Sejajar) */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Sisi Kiri: Tanggal & Filter Ringkas */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 h-8 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs font-semibold text-slate-800 cursor-pointer"
                />
              </div>

              {selectedDate !== todayStr && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className="h-8 px-2.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                >
                  Hari Ini
                </button>
              )}

              {/* Department Filter */}
              <Select size="sm"
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}>
                <option value="ALL">Semua Dept</option>
                {departmentOptions.map(d => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>

              {/* Status Filter */}
              <Select size="sm"
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}>
                <option value="ALL">Semua Status</option>
                <option value="HADIR">Hadir</option>
                <option value="TERLAMBAT">Terlambat</option>
                <option value="IZIN">Izin</option>
                <option value="SAKIT">Sakit</option>
                <option value="ALPA">Alpa</option>
                <option value="BELUM_ABSEN">Belum Absen</option>
              </Select>
            </div>

            {/* Sisi Kanan: Pencarian, Presensi Cepat, & Menu Laporan */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <div className="relative w-full sm:w-44 focus-within:sm:w-52 transition-all">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari staf / NIP..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-colors shadow-2xs"
                />
              </div>

              {/* Isi manual untuk pengecualian (izin, sakit, lupa bawa HP); absen harian lewat Mode absen */}
              <button
                type="button"
                onClick={handleOpenQuickAttendance}
                className={`${BTN_SECONDARY} shrink-0`}
                title="Isi status beberapa karyawan sekaligus: izin, sakit, alpa, atau yang lupa membawa QR"
              >
                <UserCheck className="w-4 h-4 text-slate-500" />
                Isi manual
              </button>

              {/* Absen harian dari HP karyawan lewat QR lobby; di sini hanya pengaturannya */}
              <button type="button" onClick={() => setIsPosterOpen(true)} className={`${BTN_SECONDARY} shrink-0`}>
                <QrCode className="w-4 h-4 text-slate-500" />
                QR lobby
              </button>
              <button type="button" onClick={() => setIsLocationOpen(true)} className={`${BTN_SECONDARY} shrink-0`}>
                <MapPin className="w-4 h-4 text-slate-500" />
                Lokasi absen
              </button>

              {/* Menu Opsi & Laporan (Cetak, Excel, Manual) */}
              <ActionDropdown
                triggerLabel="Laporan & Aksi"
                triggerVariant="white"
                title="Pilihan ekspor & pencatatan"
                widthClass="w-60"
                items={[
                  {
                    id: 'att-print',
                    label: 'Cetak Rekap Presensi',
                    icon: Printer,
                    onClick: () => {
                      setAttPrintTargetDate(selectedDate);
                      setIsPrintAttendanceOpen(true);
                    },
                  },
                  { id: 'att-excel', label: 'Ekspor ke Excel (.xlsx)', icon: FileSpreadsheet, onClick: handleExportAttendanceExcel },
                  { id: 'att-manual', label: 'Catat Absensi Manual', icon: Plus, onClick: handleOpenSingleAtt, dividerAbove: true },
                  {
                    id: 'att-kiosk',
                    label: 'Mode pindai QR karyawan',
                    description: 'Cadangan: perangkat di pintu memindai QR pribadi karyawan',
                    icon: ScanLine,
                    onClick: () => setIsKioskOpen(true),
                  },
                  { id: 'att-add-emp', label: 'Tambah Karyawan Baru', icon: Users, onClick: handleOpenAddEmployee },
                ]}
              />
            </div>
          </div>

          {/* Tabel Presensi Harian */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Daftar Presensi Karyawan - {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Menampilkan {filteredAttendanceRows.length} dari {activeEmployees.length} karyawan aktif.
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
                          {row.attendance && attendanceMayHavePhoto(row.attendance) ? (
                            <button
                              type="button"
                              onClick={() => handleViewPhoto(row.attendance!)}
                              disabled={loadingPhotoId === row.attendance.id}
                              className="inline-flex items-center gap-1 min-h-[44px] sm:min-h-[28px] text-[11px] font-medium text-slate-700 px-2 rounded-md border border-slate-300 hover:bg-slate-50 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                            >
                              <Camera className="w-3.5 h-3.5 text-slate-500" />
                              {loadingPhotoId === row.attendance.id ? 'Memuat…' : 'Lihat foto'}
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenSingleAtt(row.employee, row.attendance)}
                            className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
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
            {departmentOptions.map(dept => {
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
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative w-full sm:w-44 md:w-52 focus-within:sm:w-60 transition-all">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari staf / NIP..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>

              <Select size="sm"
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}>
                <option value="ALL">Semua Dept</option>
                {departmentOptions.map(d => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>

              <Select size="sm"
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}>
                <option value="ALL">Semua Status</option>
                <option value="AKTIF">Aktif</option>
                <option value="CUTI">Cuti</option>
                <option value="NONAKTIF">Nonaktif</option>
              </Select>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Split Button: Primary Tambah Karyawan + Dropdown for Other Tools */}
              <ActionDropdown
                splitAction={{
                  label: 'Tambah Karyawan',
                  icon: Plus,
                  onClick: handleOpenAddEmployee,
                  title: 'Daftarkan karyawan baru ke master data',
                  variant: 'emerald',
                }}
                header="Pilihan kelola & aksi"
                widthClass="w-64"
                items={[
                  { id: 'emp-add', label: 'Tambah Karyawan Baru', description: 'Daftarkan personil baru ke master data', icon: Plus, onClick: handleOpenAddEmployee },
                  {
                    id: 'emp-quick-att',
                    label: 'Presensi Cepat 1-Klik',
                    description: 'Presensi serentak seluruh staf hari ini',
                    icon: UserCheck,
                    onClick: () => {
                      setActiveTab('ATTENDANCE');
                      handleOpenQuickAttendance();
                    },
                  },
                  {
                    id: 'emp-manual-att',
                    label: 'Catat Absensi Manual',
                    description: 'Input kehadiran staf secara individu',
                    icon: UserCheck,
                    onClick: () => {
                      setActiveTab('ATTENDANCE');
                      handleOpenSingleAtt();
                    },
                  },
                ]}
              />

              {/* Cetak Master */}
              <button
                type="button"
                onClick={() => {
                  setEmpPrintDept(selectedDept);
                  setEmpPrintStatus(selectedStatus);
                  setEmpPrintSearch(searchQuery);
                  setIsPrintEmployeesOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer shrink-0"
                title="Cetak berkas resmi data induk / master karyawan"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Cetak Master</span>
              </button>

              {/* Ekspor Excel */}
              <button
                type="button"
                onClick={handleExportEmployeesExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer shrink-0"
                title="Unduh master data karyawan format Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ekspor Excel</span>
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
                              {accountByEmployee.get(emp.id) && (
                                <div className="text-[11px] text-emerald-800 font-medium">
                                  Akun: {ROLE_INFO[accountByEmployee.get(emp.id)!.role]?.label}
                                </div>
                              )}
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
                              onClick={() => setQrEmployee(emp)}
                              aria-label={`QR absen ${emp.name}`}
                              className="inline-flex items-center gap-1 px-2 min-h-[44px] sm:min-h-[28px] text-[11px] font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                              title="Lihat, unduh, atau bagikan QR absen"
                            >
                              <QrCode className="w-3.5 h-3.5 text-slate-500" />
                              QR absen
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditEmployee(emp)}
                              className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="Ubah data karyawan"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEmployee(emp)}
                              className="p-1 text-slate-500 hover:text-rose-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
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

      {activeTab === 'ACCOUNTS' && canManageUsers && <UserAccountsPanel />}
      </div>

      {/* =========================================================================
          MODAL 1: QUICK BATCH DAILY ATTENDANCE (1-CLICK CHECKLIST)
      ========================================================================= */}
      {isQuickModalOpen && (
        <DialogShell
          size="xl"
          title="Isi presensi manual"
          description={`${formatIndonesianDate(selectedDate)}. Untuk izin, sakit, alpa, atau yang tidak bisa absen dari HP. Hanya baris yang diubah yang disimpan.`}
          onClose={() => setIsQuickModalOpen(false)}
          onSubmit={handleSaveQuickAttendance}
          footer={
            <>
              <span className="mr-auto text-xs text-slate-600">
                {quickDirtyCount > 0 ? `${quickDirtyCount} karyawan akan disimpan` : 'Belum ada perubahan'}
              </span>
              <button type="button" onClick={() => setIsQuickModalOpen(false)} className={`${BTN_SECONDARY} ${BTN_GHOST}`}>
                Batal
              </button>
              <button type="submit" disabled={quickDirtyCount === 0} className={BTN_PRIMARY}>
                Simpan presensi
              </button>
            </>
          }
        >
          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 font-semibold min-w-[180px]">Karyawan</th>
                  <th className="py-2 px-3 font-semibold w-40">Status</th>
                  <th className="py-2 px-3 font-semibold w-32">Jam masuk</th>
                  <th className="py-2 px-3 font-semibold min-w-[180px]">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quickRows.map((row, idx) => (
                  <tr key={row.employeeId} className={row.dirty ? 'bg-emerald-50/40' : undefined}>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-900">{row.name}</div>
                      <div className="text-[11px] text-slate-600">{row.department}</div>
                    </td>
                    <td className="py-2 px-3">
                      <Select
                        className="w-full"
                        size="sm"
                        aria-label={`Status ${row.name}`}
                        value={row.status}
                        onChange={e => {
                          const status = e.target.value as AttendanceStatus | 'BELUM';
                          updateQuickRow(idx, {
                            status,
                            checkInTime: status === 'IZIN' || status === 'SAKIT' || status === 'ALPA' || status === 'BELUM' ? '' : row.checkInTime,
                          });
                        }}>
                        <option value="BELUM">Belum absen</option>
                        <option value="HADIR">Hadir</option>
                        <option value="TERLAMBAT">Terlambat</option>
                        <option value="IZIN">Izin</option>
                        <option value="SAKIT">Sakit</option>
                        <option value="ALPA">Alpa</option>
                      </Select>
                    </td>
                    <td className="py-2 px-3">
                      {row.status === 'HADIR' || row.status === 'TERLAMBAT' ? (
                        <input
                          type="time"
                          aria-label={`Jam masuk ${row.name}`}
                          value={row.checkInTime}
                          onChange={e => updateQuickRow(idx, { checkInTime: e.target.value })}
                          className={`${TABLE_INPUT} font-mono`}
                        />
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        aria-label={`Catatan ${row.name}`}
                        placeholder="Mis. izin acara keluarga"
                        value={row.notes}
                        onChange={e => updateQuickRow(idx, { notes: e.target.value })}
                        className={TABLE_INPUT}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogShell>
      )}

      {/* =========================================================================
          MODAL 2: SINGLE ATTENDANCE FORM (INDIVIDUAL & FOTO BUKTI WEBP)
      ========================================================================= */}
      {isSingleAttModalOpen && (
        <FormDialog
          title="Presensi karyawan"
          description="Catat atau ubah kehadiran satu karyawan."
          onClose={() => setIsSingleAttModalOpen(false)}
          onSubmit={handleSaveSingleAtt}
          submitLabel="Simpan presensi"
        >
                <div>
                  <span className={FIELD_LABEL}>Karyawan</span>
                  <SearchPicker
                    value={singleAttEmpId}
                    options={[...activeEmployees]
                      .sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name))
                      .map(emp => ({ value: emp.id, label: `${emp.name} · ${emp.position}`, group: emp.department, hint: emp.nip }))}
                    onSelect={opt => opt && setSingleAttEmpId(opt.value)}
                    placeholder="Pilih karyawan"
                    searchPlaceholder="Cari nama atau jabatan..."
                    ariaLabel="Pilih karyawan"
                    noun="pegawai"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="sa-date" className={FIELD_LABEL}>Tanggal</label>
                    <input id="sa-date" type="date" required value={singleAttDate} onChange={e => setSingleAttDate(e.target.value)} className={FIELD_INPUT} />
                  </div>
                  <div>
                    <label htmlFor="sa-status" className={FIELD_LABEL}>Status</label>
                    <Select
                      id="sa-status"
                      className="w-full"
                      value={singleAttStatus === 'TERLAMBAT' ? 'HADIR' : singleAttStatus}
                      onChange={e => setSingleAttStatus(e.target.value as AttendanceStatus)}>
                      <option value="HADIR">Hadir</option>
                      <option value="IZIN">Izin</option>
                      <option value="SAKIT">Sakit</option>
                      <option value="ALPA">Alpa (tanpa keterangan)</option>
                    </Select>
                  </div>
                </div>

                {(singleAttStatus === 'HADIR' || singleAttStatus === 'TERLAMBAT') && (
                  <div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="sa-in" className={FIELD_LABEL}>Jam masuk</label>
                        <input id="sa-in" type="time" required value={singleAttCheckIn} onChange={e => setSingleAttCheckIn(e.target.value)} className={`${FIELD_INPUT} font-mono`} />
                      </div>
                      <div>
                        <label htmlFor="sa-out" className={FIELD_LABEL}>Jam pulang</label>
                        <input id="sa-out" type="time" value={singleAttCheckOut} onChange={e => setSingleAttCheckOut(e.target.value)} className={`${FIELD_INPUT} font-mono`} />
                      </div>
                    </div>
                    {/* Terlambat dihitung dari jam kerja karyawan, sama seperti absen dari HP */}
                    <p className={`mt-1 text-[11px] ${singleAttLate > 0 ? 'text-amber-800' : 'text-slate-600'}`}>
                      {!singleAttCheckIn
                        ? 'Isi jam masuk.'
                        : singleAttSchedule.flexible
                          ? 'Jam kerja fleksibel, tidak dihitung terlambat.'
                          : singleAttLate > 0
                            ? `Terlambat ${formatDuration(singleAttLate)} dari jam mulai ${singleAttSchedule.start}.`
                            : `Tepat waktu (jam mulai ${singleAttSchedule.start}).`}
                    </p>
                  </div>
                )}

                <div>
                  <label htmlFor="sa-notes" className={FIELD_LABEL}>Catatan</label>
                  <textarea
                    id="sa-notes"
                    rows={2}
                    value={singleAttNotes}
                    onChange={e => setSingleAttNotes(e.target.value)}
                    placeholder="Mis. izin acara keluarga, sakit demam"
                    className={`${FIELD_INPUT} py-2 leading-relaxed`}
                  />
                </div>

                <PhotoUploadCompressor
                  photos={singleAttPhotos}
                  onChange={photos => {
                    setSingleAttPhotos(photos);
                    setSingleAttPhotoTouched(true);
                  }}
                  maxPhotos={1}
                  folder="profile"
                  label="Foto bukti (opsional)"
                  description="Mis. surat dokter atau foto kehadiran. Otomatis dikompres."
                  emptyText="Belum ada foto."
                />
        </FormDialog>
      )}

      {/* =========================================================================
          MODAL 3: EMPLOYEE MASTER (ADD / EDIT)
      ========================================================================= */}
      {isEmployeeModalOpen && (
        <DialogShell
          size="lg"
          title={editingEmployeeId ? 'Ubah data karyawan' : 'Tambah karyawan'}
          description="Bagian dan jam kerja dipakai untuk absen dan menghitung keterlambatan."
          onClose={() => setIsEmployeeModalOpen(false)}
          onSubmit={handleSaveEmployee}
          footer={
            <>
              <button type="button" onClick={() => setIsEmployeeModalOpen(false)} className={`${BTN_SECONDARY} ${BTN_GHOST}`}>
                Batal
              </button>
              <button type="submit" className={BTN_PRIMARY}>
                {editingEmployeeId ? 'Simpan perubahan' : 'Tambah karyawan'}
              </button>
            </>
          }
        >
                {/* Nama Lengkap & Gender */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className={FIELD_LABEL}>
                      Nama Lengkap Karyawan *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Misal: Slamet Riyadi, S.E."
                      value={empName}
                      onChange={e => setEmpName(e.target.value)}
                      className={FIELD_INPUT}
                    />
                  </div>

                  <div>
                    <label className={FIELD_LABEL}>
                      Jenis Kelamin
                    </label>
                    <Select className="w-full"
                      value={empGender}
                      onChange={e => setEmpGender(e.target.value as 'L' | 'P')}>
                      <option value="L">Laki-Laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </Select>
                  </div>
                </div>

                {/* NIP & NIK */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={FIELD_LABEL}>
                      NIP SPPG *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="SPPG-JT-019"
                      value={empNip}
                      onChange={e => setEmpNip(e.target.value)}
                      className={`${FIELD_INPUT} font-mono`}
                    />
                  </div>

                  <div>
                    <label className={FIELD_LABEL}>
                      NIK KTP (16 Digit)
                    </label>
                    <input
                      type="text"
                      placeholder="350719..."
                      value={empNik}
                      onChange={e => setEmpNik(e.target.value)}
                      className={`${FIELD_INPUT} font-mono`}
                    />
                  </div>
                </div>

                {/* Departemen & Jabatan */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={FIELD_LABEL}>
                      Bagian *
                    </label>
                    <Select className="w-full"
                      value={empDept}
                      onChange={e => setEmpDept(e.target.value as EmployeeDepartment)}>
                      {departmentOptions.map(d => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className={FIELD_LABEL}>
                      Jabatan / Posisi Kerja *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Misal: Juru Masak Sayur & Kuah"
                      value={empPosition}
                      onChange={e => setEmpPosition(e.target.value)}
                      className={FIELD_INPUT}
                    />
                  </div>
                </div>

                {/* Jam kerja: jam tetap dipakai menghitung terlambat; fleksibel hanya mencatat jam masuk & pulang */}
                <div>
                  <span className={FIELD_LABEL}>Jam kerja</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      className="w-36"
                      aria-label="Jenis jam kerja"
                      value={empSchedule.flexible ? 'FLEX' : 'FIXED'}
                      onChange={e =>
                        setEmpShift(
                          e.target.value === 'FLEX'
                            ? FLEXIBLE_SCHEDULE
                            : formatSchedule({ flexible: false, start: '05:00', end: '13:00', overnight: false })
                        )
                      }>
                      <option value="FIXED">Jam tetap</option>
                      <option value="FLEX">Fleksibel</option>
                    </Select>
                    {!empSchedule.flexible && (
                      <>
                        {/* Lebar tetap: FIELD_INPUT selalu w-full, jadi lebarnya diatur oleh pembungkus */}
                        <div className="w-32">
                          <input
                            type="time"
                            aria-label="Jam mulai"
                            value={empSchedule.start || ''}
                            onChange={e => setEmpShift(formatSchedule({ ...empSchedule, start: e.target.value }))}
                            className={`${FIELD_INPUT} font-mono`}
                          />
                        </div>
                        <span className="text-xs text-slate-600">sampai</span>
                        <div className="w-32">
                          <input
                            type="time"
                            aria-label="Jam selesai"
                            value={empSchedule.end || ''}
                            onChange={e => setEmpShift(formatSchedule({ ...empSchedule, end: e.target.value }))}
                            className={`${FIELD_INPUT} font-mono`}
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">
                    {empSchedule.flexible
                      ? 'Tidak dihitung terlambat. Jam masuk, pulang, dan lama kerja tetap tercatat.'
                      : empSchedule.overnight
                        ? 'Shift lewat tengah malam: absen pulang dicatat ke hari masuk.'
                        : 'Terlambat dihitung bila masuk lebih dari 10 menit setelah jam mulai.'}
                  </p>
                </div>

                {/* Hubungan Kerja & Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={FIELD_LABEL}>
                      Status Kerja
                    </label>
                    <Select className="w-full"
                      value={empEmploymentType}
                      onChange={e => setEmpEmploymentType(e.target.value as EmploymentType)}>
                      {EMPLOYMENT_TYPES.map(t => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className={FIELD_LABEL}>
                      Status Keaktifan
                    </label>
                    <Select className="w-full"
                      value={empStatus}
                      onChange={e => setEmpStatus(e.target.value as 'AKTIF' | 'CUTI' | 'NONAKTIF')}>
                      <option value="AKTIF">Aktif</option>
                      <option value="CUTI">Cuti</option>
                      <option value="NONAKTIF">Nonaktif</option>
                    </Select>
                  </div>
                </div>

                {/* Kontak & Tanggal Bergabung */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={FIELD_LABEL}>
                      No. WhatsApp / HP
                    </label>
                    <input
                      type="text"
                      placeholder="0812-3456-7890"
                      value={empPhone}
                      onChange={e => setEmpPhone(e.target.value)}
                      className={`${FIELD_INPUT} font-mono`}
                    />
                  </div>

                  <div>
                    <label className={FIELD_LABEL}>
                      Tanggal Bergabung
                    </label>
                    <input
                      type="date"
                      value={empJoinDate}
                      onChange={e => setEmpJoinDate(e.target.value)}
                      className={FIELD_INPUT}
                    />
                  </div>
                </div>

                {/* Alamat & Kontak Darurat */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={FIELD_LABEL}>
                      Alamat Domisili
                    </label>
                    <input
                      type="text"
                      placeholder="Desa Jeru, Kec. Tumpang, Kab. Malang"
                      value={empAddress}
                      onChange={e => setEmpAddress(e.target.value)}
                      className={FIELD_INPUT}
                    />
                  </div>

                  <div>
                    <label className={FIELD_LABEL}>
                      Kontak Darurat (Nama & No. HP)
                    </label>
                    <input
                      type="text"
                      placeholder="0812-9988-7766 (Istri - Rini)"
                      value={empEmergencyContact}
                      onChange={e => setEmpEmergencyContact(e.target.value)}
                      className={FIELD_INPUT}
                    />
                  </div>
                </div>

                {/* Catatan Tambahan */}
                <div>
                  <label className={FIELD_LABEL}>
                    Catatan Kualifikasi / Keterangan Staf
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Pengalaman memasak, sertifikat higienitas, lisensi mengemudi SIM B1, dll..."
                    value={empNotes}
                    onChange={e => setEmpNotes(e.target.value)}
                    className={`${FIELD_INPUT} py-2 leading-relaxed`}
                  />
                </div>
        </DialogShell>
      )}

      {/* =========================================================================
          MODAL 4: PHOTO PREVIEW POPUP
      ========================================================================= */}
      {photoPreviewUrl && (
        <DialogShell
          size="md"
          title="Foto absen"
          description="Foto diambil saat absen masuk. Dihapus otomatis setelah 60 hari."
          onClose={() => setPhotoPreviewUrl(null)}
          footer={
            <button type="button" onClick={() => setPhotoPreviewUrl(null)} className={BTN_SECONDARY}>
              Tutup
            </button>
          }
        >
          <div className="rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
            <img src={photoPreviewUrl} alt="Foto absen" className="w-full h-auto object-contain max-h-[65vh]" />
          </div>
        </DialogShell>
      )}

      {/* =========================================================================
          MODAL 5: MODAL CETAK & PRATINJAU PRESENSI KARYAWAN
      ========================================================================= */}
      {isPrintAttendanceOpen && (
        <DialogShell
          size={attPrintMode === 'RANGE' ? 'full' : '2xl'}
          title="Cetak laporan presensi"
          description="Pilih harian atau rentang tanggal. Di dialog cetak, pilih Save as PDF untuk menyimpan arsip."
          onClose={() => setIsPrintAttendanceOpen(false)}
          footer={
            <>
              <button type="button" onClick={() => setIsPrintAttendanceOpen(false)} className={`${BTN_SECONDARY} ${BTN_GHOST}`}>
                Tutup
              </button>
              <button type="button" onClick={() => window.print()} className={BTN_PRIMARY}>
                <Printer className="w-4 h-4" />
                Cetak / simpan PDF
              </button>
            </>
          }
        >
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div role="tablist" aria-label="Jenis laporan" className="inline-flex gap-1 p-1 bg-slate-100 rounded-lg">
                  {([
                    ['DAILY', 'Harian'],
                    ['RANGE', 'Rentang tanggal'],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={attPrintMode === id}
                      onClick={() => setAttPrintMode(id)}
                      className={`px-3 min-h-[44px] sm:min-h-[30px] rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                        attPrintMode === id ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                {/* Date Controls */}
                {attPrintMode === 'DAILY' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">Tanggal:</span>
                    <input
                      type="date"
                      value={attPrintTargetDate}
                      onChange={e => setAttPrintTargetDate(e.target.value)}
                      className="px-2 min-h-[44px] sm:min-h-[30px] rounded-md border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => setAttPrintTargetDate(todayStr)}
                      className="px-2.5 min-h-[44px] sm:min-h-[30px] text-[11px] font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                      Hari Ini
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-600 font-medium">Periode:</span>
                    <input
                      type="date"
                      value={attPrintStartDate}
                      onChange={e => setAttPrintStartDate(e.target.value)}
                      className="px-2 min-h-[44px] sm:min-h-[30px] rounded-md border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    />
                    <span className="text-slate-400">s/d</span>
                    <input
                      type="date"
                      value={attPrintEndDate}
                      onChange={e => setAttPrintEndDate(e.target.value)}
                      className="px-2 min-h-[44px] sm:min-h-[30px] rounded-md border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 6);
                        setAttPrintStartDate(localDateIso(d));
                        setAttPrintEndDate(todayStr);
                      }}
                      className="px-2.5 min-h-[44px] sm:min-h-[30px] text-[11px] font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                      7 Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 13);
                        setAttPrintStartDate(localDateIso(d));
                        setAttPrintEndDate(todayStr);
                      }}
                      className="px-2.5 min-h-[44px] sm:min-h-[30px] text-[11px] font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                      14 Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const start = localDateIso(new Date(now.getFullYear(), now.getMonth(), 1));
                        setAttPrintStartDate(start);
                        setAttPrintEndDate(todayStr);
                      }}
                      className="px-2.5 min-h-[44px] sm:min-h-[30px] text-[11px] font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                      Bulan Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 29);
                        setAttPrintStartDate(localDateIso(d));
                        setAttPrintEndDate(todayStr);
                      }}
                      className="px-2.5 min-h-[44px] sm:min-h-[30px] text-[11px] font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                      30 Hari
                    </button>
                    {/* Rekap honor dicetak setelah bulan berakhir */}
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setAttPrintStartDate(localDateIso(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
                        setAttPrintEndDate(localDateIso(new Date(now.getFullYear(), now.getMonth(), 0)));
                      }}
                      className="px-2.5 min-h-[44px] sm:min-h-[30px] text-[11px] font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                      Bulan Lalu
                    </button>
                    <span className="text-[11px] text-slate-600">
                      {printRangeDaysCount} hari, dicetak A4 mendatar
                    </span>
                  </div>
                )}

                <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                {/* Filter Divisi */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-medium">Bagian:</span>
                  <Select size="sm"
                    value={attPrintDept}
                    onChange={e => setAttPrintDept(e.target.value)}>
                    <option value="ALL">Semua bagian</option>
                    {departmentOptions.map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Filter Status (Untuk Harian) */}
                {attPrintMode === 'DAILY' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 font-medium">Status:</span>
                    <Select size="sm"
                      value={attPrintStatus}
                      onChange={e => setAttPrintStatus(e.target.value)}>
                      <option value="ALL">Semua Status</option>
                      <option value="HADIR">Hadir Tepat Waktu</option>
                      <option value="TERLAMBAT">Terlambat</option>
                      <option value="IZIN">Izin</option>
                      <option value="SAKIT">Sakit</option>
                      <option value="ALPA">Alpa</option>
                      <option value="BELUM_ABSEN">Belum Absen</option>
                    </Select>
                  </div>
                )}
              </div>

            {/* Pratinjau kertas: latar abu-abu memisahkan lembar cetak dari kontrol */}
            <div className="rounded-xl bg-slate-100 p-3 sm:p-5 overflow-x-auto">
              <div className="bg-white rounded-lg border border-slate-200 p-5 sm:p-8 max-w-4xl mx-auto">
                {renderPrintableAttendanceSheet()}
              </div>
            </div>
        </DialogShell>
      )}

      {/* =========================================================================
          MODAL 6: MODAL CETAK & PRATINJAU MASTER KARYAWAN
      ========================================================================= */}
      {isPrintEmployeesOpen && (
        <DialogShell
          size="2xl"
          title="Cetak data karyawan"
          description="Daftar karyawan per bagian dengan kop SPPG. Di dialog cetak, pilih Save as PDF untuk menyimpan arsip."
          onClose={() => setIsPrintEmployeesOpen(false)}
          footer={
            <>
              <button type="button" onClick={() => setIsPrintEmployeesOpen(false)} className={`${BTN_SECONDARY} ${BTN_GHOST}`}>
                Tutup
              </button>
              <button type="button" onClick={() => window.print()} className={BTN_PRIMARY}>
                <Printer className="w-4 h-4" />
                Cetak / simpan PDF
              </button>
            </>
          }
        >
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {/* Filter Divisi */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-medium">Bagian:</span>
                  <Select size="sm"
                    value={empPrintDept}
                    onChange={e => setEmpPrintDept(e.target.value)}>
                    <option value="ALL">Semua bagian</option>
                    {departmentOptions.map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Filter Status Keaktifan */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-medium">Status:</span>
                  <Select size="sm"
                    value={empPrintStatus}
                    onChange={e => setEmpPrintStatus(e.target.value)}>
                    <option value="ALL">Semua Status</option>
                    <option value="AKTIF">Aktif</option>
                    <option value="CUTI">Cuti</option>
                    <option value="NONAKTIF">Nonaktif</option>
                  </Select>
                </div>

                {/* Search Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-medium">Cari:</span>
                  <input
                    type="text"
                    placeholder="Nama, NIP, posisi..."
                    value={empPrintSearch}
                    onChange={e => setEmpPrintSearch(e.target.value)}
                    aria-label="Cari karyawan"
                    className="px-2 min-h-[44px] sm:min-h-[30px] rounded-md border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-500 w-44 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                  {empPrintSearch && (
                    <button
                      type="button"
                      onClick={() => setEmpPrintSearch('')}
                      className="text-slate-700 hover:text-slate-900 text-xs font-medium underline underline-offset-2 cursor-pointer"
                    >
                      Hapus pencarian
                    </button>
                  )}
                </div>
              </div>

            <div className="rounded-xl bg-slate-100 p-3 sm:p-5 overflow-x-auto">
              <div className="bg-white rounded-lg border border-slate-200 p-5 sm:p-8 max-w-4xl mx-auto">
                {renderPrintableEmployeesSheet()}
              </div>
            </div>
        </DialogShell>
      )}

      {/* =========================================================================
          CONTAINER CETAK TERSEMBUNYI (DITAMPILKAN KETIKA WINDOW.PRINT() DIPANGGIL)
      ========================================================================= */}
      <div className="hidden print:block">
        {isPosterOpen ? (
          <div id="print-attendance-poster">
            <AttendancePosterSheet qrDataUrl={posterQr} />
          </div>
        ) : isPrintEmployeesOpen || (!isPrintAttendanceOpen && activeTab === 'EMPLOYEES') ? (
          renderPrintableEmployeesSheet()
        ) : (
          renderPrintableAttendanceSheet()
        )}
      </div>

      {isKioskOpen && (
        <AttendanceKiosk
          onClose={() => {
            setIsKioskOpen(false);
            refreshData();
          }}
        />
      )}
      {qrEmployee && <EmployeeQrDialog employee={qrEmployee} onClose={() => setQrEmployee(null)} />}
      {isLocationOpen && (
        <AttendanceLocationDialog
          onClose={() => setIsLocationOpen(false)}
          onSaved={() => {
            setIsLocationOpen(false);
            setGeofenceVersion(v => v + 1);
            showToast('Lokasi absen tersimpan. Karyawan sudah bisa absen dari HP di area SPPG.');
          }}
        />
      )}
      {isPosterOpen && <AttendancePosterDialog onClose={() => setIsPosterOpen(false)} onPrint={() => window.print()} />}
    </div>
  );
};
