import React, { useState, useMemo, useEffect } from 'react';
import { Select } from './common/Select';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { KopText } from './common/KopText';
import { DateStepper } from './common/DateStepper';
import { useAuth } from '../context/AuthContext';
import { warehouseDb, signerName, APP_SETTINGS_CHANGED_EVENT } from '../db/storage';
import { DailyTodoItem, TodoCategory, TodoPriority, UserRole } from '../types/warehouse';
import { exportMultiSheetExcel } from '../lib/excelExport';
import { localDateIso } from '../utils/localDate';
import { SppgLogo } from './SppgLogo';
import { ROLE_INFO } from './UserManagementModule';
import { FormDialog, FIELD_INPUT, FIELD_LABEL, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, FOCUS_RING } from './common/FormDialog';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  FileSpreadsheet,
  Printer,
  Clock,
  ListTodo,
  AlertCircle,
  RotateCcw,
  Eye,
  EyeOff,
  Users,
  Edit2,
  ClipboardCheck,
  Copy,
  Save,
} from 'lucide-react';
import { DocSignatureToggle, OfficerSignatureImg } from './common/OfficerSignatureImg';

export interface ProfileModuleProps {
  onNavigate?: (tab: string) => void;
}

type SubTab = 'profile' | 'todos' | 'report';
type ReportViewMode = 'DAILY' | 'PERIOD';
type PeriodPreset = 'LAST_7_DAYS' | 'THIS_MONTH' | 'CUSTOM';

const TODO_CATEGORIES: TodoCategory[] = [
  'Penerimaan & QC',
  'Persiapan Dapur',
  'Sanitasi & Kebersihan',
  'Administrasi & Stok',
  'Stock Opname',
  'Distribusi',
];

const PRIORITY_TONE: Record<TodoPriority, string> = {
  Tinggi: 'bg-rose-50 text-rose-800 border-rose-200',
  Sedang: 'bg-amber-50 text-amber-800 border-amber-200',
  Rendah: 'bg-slate-50 text-slate-700 border-slate-200',
};

const BADGE = 'inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md border';
const MIN_PASSWORD = 6;

// "2026-10-17" -> Date lokal; new Date("2026-10-17") dibaca sebagai UTC.
const parseIsoDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatLongDate = (iso: string) =>
  parseIsoDate(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const formatShortDate = (iso: string) =>
  parseIsoDate(iso).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const nowTimeDot = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
};

const roleLabel = (role?: string) => (role && ROLE_INFO[role as UserRole]?.label) || role || '-';

export const ProfileModule: React.FC<ProfileModuleProps> = ({ onNavigate }) => {
  const { currentUser, updateProfile, availableUsers, can } = useAuth();
  const askConfirm = useConfirm();
  const toast = useToast();

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('profile');

  // --- Profil ---
  const [name, setName] = useState<string>(currentUser.name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // --- Tugas harian ---
  const todayStr = localDateIso();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [syncVersion, setSyncVersion] = useState(0);
  const [todos, setTodos] = useState<DailyTodoItem[]>(() => warehouseDb.getDailyTodos(todayStr));
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING'>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('ALL');

  // Modal tambah / ubah tugas
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [taskError, setTaskError] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<TodoCategory>('Penerimaan & QC');
  const [formPriority, setFormPriority] = useState<TodoPriority>('Tinggi');
  const [formSession, setFormSession] = useState<'Pagi' | 'Siang' | 'Sore' | 'Harian'>('Pagi');
  const [formTargetTime, setFormTargetTime] = useState('08:00');
  const [formAssignedUserId, setFormAssignedUserId] = useState('');
  const [formAssignedRole, setFormAssignedRole] = useState<UserRole | 'ALL'>('ALL');
  const [formNotes, setFormNotes] = useState('');

  // Modal lapor hasil pelaksanaan per tugas
  const [reportingTodo, setReportingTodo] = useState<DailyTodoItem | null>(null);
  const [reportTaskCompleted, setReportTaskCompleted] = useState(true);
  const [reportTaskTime, setReportTaskTime] = useState('');
  const [reportTaskNotes, setReportTaskNotes] = useState('');

  // --- Laporan harian & rekap periode ---
  const [reportViewMode, setReportViewMode] = useState<ReportViewMode>('DAILY');
  const [reportSummary, setReportSummary] = useState('');
  const [reportIssues, setReportIssues] = useState('');
  const [reportFollowUp, setReportFollowUp] = useState('');
  const [reportNoteUpdatedBy, setReportNoteUpdatedBy] = useState<string | undefined>(undefined);
  const [isReportNoteDirty, setIsReportNoteDirty] = useState(false);

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('LAST_7_DAYS');
  const [periodStart, setPeriodStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return localDateIso(d);
  });
  const [periodEnd, setPeriodEnd] = useState<string>(todayStr);

  const refreshTodos = (date = selectedDate) => {
    setTodos(warehouseDb.getDailyTodos(date));
    setSyncVersion(v => v + 1);
  };

  // Sinkronisasi tugas & catatan laporan lintas perangkat.
  useEffect(() => {
    const onSync = () => {
      setTodos(warehouseDb.getDailyTodos(selectedDate));
      setSyncVersion(v => v + 1);
    };
    window.addEventListener('sppg_warehouse_sync', onSync);
    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, onSync);
    return () => {
      window.removeEventListener('sppg_warehouse_sync', onSync);
      window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, onSync);
    };
  }, [selectedDate]);

  // Muat catatan laporan harian saat tanggal berganti (jangan menimpa ketikan yang belum disimpan).
  useEffect(() => {
    const saved = warehouseDb.getDailyTodoReportNote(selectedDate);
    setReportSummary(saved?.summary || '');
    setReportIssues(saved?.issues || '');
    setReportFollowUp(saved?.followUp || '');
    setReportNoteUpdatedBy(saved?.updatedBy);
    setIsReportNoteDirty(false);
  }, [selectedDate]);

  useEffect(() => {
    if (isReportNoteDirty) return;
    const saved = warehouseDb.getDailyTodoReportNote(selectedDate);
    setReportSummary(saved?.summary || '');
    setReportIssues(saved?.issues || '');
    setReportFollowUp(saved?.followUp || '');
    setReportNoteUpdatedBy(saved?.updatedBy);
  }, [syncVersion, selectedDate, isReportNoteDirty]);

  const handleDateChange = (date: string) => {
    if (!date) return;
    setSelectedDate(date);
    setTodos(warehouseDb.getDailyTodos(date));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');

    if (!name.trim()) {
      setProfileError('Nama lengkap wajib diisi.');
      return;
    }
    if (newPassword || confirmPassword) {
      if (!currentPassword) {
        setProfileError('Isi kata sandi saat ini untuk mengganti kata sandi.');
        return;
      }
      if (newPassword.length < MIN_PASSWORD) {
        setProfileError(`Kata sandi baru minimal ${MIN_PASSWORD} karakter.`);
        return;
      }
      if (newPassword !== confirmPassword) {
        setProfileError('Konfirmasi kata sandi baru tidak cocok.');
        return;
      }
    }

    setIsSavingProfile(true);
    const result = await updateProfile({
      name: name.trim(),
      currentPassword: newPassword ? currentPassword : undefined,
      password: newPassword || undefined,
    });
    setIsSavingProfile(false);

    if (result.success) {
      toast.success(newPassword ? 'Profil dan kata sandi tersimpan.' : 'Profil tersimpan.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setProfileError(result.error || 'Profil gagal disimpan.');
    }
  };

  const handleToggleTodo = (todoId: string) => {
    const updated = warehouseDb.toggleTodo(todoId, currentUser);
    const next = todos.map(t => (t.id === todoId ? updated : t));
    setTodos(next);

    if (updated.isCompleted && next.length > 0 && next.every(t => t.isCompleted)) {
      toast.success('Semua tugas tanggal ini selesai. Laporannya siap dicetak di tab Laporan.');
    }
  };

  const openAddModal = () => {
    setEditingTodoId(null);
    setTaskError('');
    setFormTitle('');
    setFormCategory('Penerimaan & QC');
    setFormPriority('Tinggi');
    setFormSession('Pagi');
    setFormTargetTime('08:00');
    setFormAssignedUserId('');
    setFormAssignedRole('ALL');
    setFormNotes('');
    setIsTaskModalOpen(true);
  };

  const openEditModal = (todo: DailyTodoItem) => {
    setEditingTodoId(todo.id);
    setTaskError('');
    setFormTitle(todo.title);
    setFormCategory(todo.category);
    setFormPriority(todo.priority);
    setFormSession(todo.session || 'Harian');
    setFormTargetTime(todo.targetTime || '');
    setFormAssignedUserId(todo.assignedUserId || '');
    setFormAssignedRole(todo.assignedRole || 'ALL');
    setFormNotes(todo.notes || '');
    setIsTaskModalOpen(true);
  };

  const handleSaveTaskModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setTaskError('Uraian tugas wajib diisi.');
      return;
    }

    const assignedUser = availableUsers?.find(u => u.id === formAssignedUserId);
    const payload = {
      title: formTitle.trim(),
      category: formCategory,
      priority: formPriority,
      session: formSession,
      targetTime: formTargetTime || undefined,
      assignedUserId: assignedUser?.id,
      assignedUserName: assignedUser?.name,
      assignedRole: assignedUser ? assignedUser.role : formAssignedRole,
      notes: formNotes.trim() || undefined,
    };

    if (editingTodoId) {
      warehouseDb.updateTodo(editingTodoId, payload, currentUser);
      toast.success(`Tugas "${payload.title}" diperbarui.`);
    } else {
      warehouseDb.addTodo(
        {
          date: selectedDate,
          ...payload,
          isCompleted: false,
        },
        currentUser
      );
      toast.success(`Tugas "${payload.title}" ditambahkan.`);
    }

    setIsTaskModalOpen(false);
    setEditingTodoId(null);
    refreshTodos();
  };

  const openTaskReportModal = (todo: DailyTodoItem) => {
    setReportingTodo(todo);
    setReportTaskCompleted(true);
    setReportTaskTime(todo.completedAt ? todo.completedAt.replace('.', ':') : nowTimeDot().replace('.', ':'));
    setReportTaskNotes(todo.notes || '');
  };

  const handleSaveTaskReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingTodo) return;
    const formattedClock = reportTaskTime ? reportTaskTime.replace(':', '.') : nowTimeDot();
    warehouseDb.updateTodo(
      reportingTodo.id,
      {
        isCompleted: reportTaskCompleted,
        completedAt: reportTaskCompleted ? formattedClock : undefined,
        completedBy: reportTaskCompleted ? `${currentUser.name} (${currentUser.role})` : undefined,
        notes: reportTaskNotes.trim() || undefined,
      },
      currentUser
    );
    setReportingTodo(null);
    refreshTodos();
    toast.success(`Hasil pelaksanaan "${reportingTodo.title}" tersimpan.`);
  };

  const handleDeleteTodo = async (id: string, title: string) => {
    if (await askConfirm({ title: `Hapus tugas "${title}"?`, confirmText: 'Hapus tugas', variant: 'danger' })) {
      warehouseDb.deleteTodo(id, currentUser);
      refreshTodos();
      toast.success(`Tugas "${title}" dihapus.`);
    }
  };

  const handleClearDayTodos = async () => {
    if (totalTasks === 0) return;
    if (
      await askConfirm({
        title: `Kosongkan semua tugas ${formatShortDate(selectedDate)}?`,
        message: `${totalTasks} tugas pada tanggal ini akan dihapus permanen dan tidak muncul lagi.`,
        confirmText: 'Kosongkan',
        variant: 'danger',
      })
    ) {
      const removed = warehouseDb.clearDailyTodos(selectedDate, currentUser);
      refreshTodos();
      toast.success(`${removed} tugas harian dikosongkan.`);
    }
  };

  const lastTodoDateBefore = useMemo(
    () => warehouseDb.getLastTodoDateBefore(selectedDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDate, syncVersion]
  );

  const handleCopyPreviousTodos = () => {
    if (!lastTodoDateBefore) return;
    const copied = warehouseDb.copyDailyTodos(lastTodoDateBefore, selectedDate, currentUser);
    refreshTodos();
    toast.success(`${copied.length} tugas disalin dari ${formatShortDate(lastTodoDateBefore)}.`);
  };

  const handleResetTodos = async () => {
    if (
      await askConfirm({
        title: 'Muat 8 tugas standar operasional?',
        message:
          totalTasks > 0
            ? `Daftar tugas ${formatLongDate(selectedDate)} akan diganti dengan 8 tugas standar operasional SPPG.`
            : `Tambahkan 8 tugas standar operasional SPPG untuk ${formatLongDate(selectedDate)}?`,
        confirmText: 'Muat tugas standar',
        variant: totalTasks > 0 ? 'warning' : 'primary',
      })
    ) {
      warehouseDb.resetDailyTodos(selectedDate, currentUser);
      refreshTodos();
      toast.success('8 tugas standar operasional dimuat.');
    }
  };

  const handleSaveReportNote = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = warehouseDb.saveDailyTodoReportNote(
      {
        date: selectedDate,
        summary: reportSummary,
        issues: reportIssues,
        followUp: reportFollowUp,
      },
      currentUser
    );
    setReportNoteUpdatedBy(saved.updatedBy);
    setIsReportNoteDirty(false);
    setSyncVersion(v => v + 1);
    toast.success(`Catatan laporan ${formatShortDate(selectedDate)} tersimpan.`);
  };

  const filteredTodos = useMemo(
    () =>
      todos.filter(item => {
        const matchCat = categoryFilter === 'ALL' || item.category === categoryFilter;
        const matchStatus =
          statusFilter === 'ALL' ||
          (statusFilter === 'COMPLETED' && item.isCompleted) ||
          (statusFilter === 'PENDING' && !item.isCompleted);
        const matchStaff =
          staffFilter === 'ALL' ||
          (staffFilter === 'ME'
            ? item.assignedUserId === currentUser.id ||
              (!item.assignedUserId && (item.assignedRole === currentUser.role || item.assignedRole === 'ALL'))
            : item.assignedUserId === staffFilter);
        return matchCat && matchStatus && matchStaff;
      }),
    [todos, categoryFilter, statusFilter, staffFilter, currentUser]
  );

  const categoryOptions = useMemo(
    () => Array.from(new Set([...TODO_CATEGORIES, ...todos.map(t => t.category)])),
    [todos]
  );

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { category: string; total: number; done: number }>();
    todos.forEach(t => {
      const entry = map.get(t.category) || { category: t.category, total: 0, done: 0 };
      entry.total += 1;
      if (t.isCompleted) entry.done += 1;
      map.set(t.category, entry);
    });
    return Array.from(map.values());
  }, [todos]);

  const totalTasks = todos.length;
  const completedTasks = todos.filter(t => t.isCompleted).length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const isAllCompleted = totalTasks > 0 && completedTasks === totalTasks;
  const isToday = selectedDate === todayStr;

  // Jam selesai paling akhir (format "HH.MM"), bukan urutan terakhir di daftar.
  const lastCompletedAt = todos
    .map(t => t.completedAt)
    .filter((v): v is string => Boolean(v))
    .sort()
    .pop();

  // --- Data rekap periode ---
  const effectivePeriod = useMemo(() => {
    if (periodPreset === 'LAST_7_DAYS') {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return { start: localDateIso(start), end: localDateIso(end), label: '7 hari terakhir' };
    }
    if (periodPreset === 'THIS_MONTH') {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: localDateIso(start), end: localDateIso(end), label: 'Bulan ini' };
    }
    return { start: periodStart, end: periodEnd, label: `${formatShortDate(periodStart)} s/d ${formatShortDate(periodEnd)}` };
  }, [periodPreset, periodStart, periodEnd]);

  const periodReport = useMemo(() => {
    const list = warehouseDb.getTodosInRange(effectivePeriod.start, effectivePeriod.end);
    const byDate = new Map<string, { date: string; total: number; done: number; pending: number; summary: string }>();
    const byCategory = new Map<string, { category: string; total: number; done: number }>();

    list.forEach(t => {
      const day = byDate.get(t.date) || {
        date: t.date,
        total: 0,
        done: 0,
        pending: 0,
        summary: warehouseDb.getDailyTodoReportNote(t.date)?.summary || '',
      };
      day.total += 1;
      if (t.isCompleted) day.done += 1;
      else day.pending += 1;
      byDate.set(t.date, day);

      const cat = byCategory.get(t.category) || { category: t.category, total: 0, done: 0 };
      cat.total += 1;
      if (t.isCompleted) cat.done += 1;
      byCategory.set(t.category, cat);
    });

    const days = Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
    const categories = Array.from(byCategory.values()).sort((a, b) => b.total - a.total);
    const total = list.length;
    const done = list.filter(t => t.isCompleted).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    return { list, days, categories, total, done, pending: total - done, pct };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePeriod, syncVersion]);

  const handleExportDailyExcel = () => {
    const detailRows = todos.map((t, index) => ({
      No: index + 1,
      Tanggal: t.date,
      'Target Jam': t.targetTime || '-',
      Sesi: t.session || 'Harian',
      Kategori: t.category,
      'Uraian Tugas': t.title,
      'Ditugaskan ke': t.assignedUserName || (t.assignedRole && t.assignedRole !== 'ALL' ? roleLabel(t.assignedRole) : 'Semua petugas'),
      Prioritas: t.priority,
      Status: t.isCompleted ? 'Selesai' : 'Belum selesai',
      'Jam Selesai': t.completedAt || '-',
      'Diselesaikan oleh': t.completedBy || '-',
      'Hasil / Catatan': t.notes || '-',
    }));

    const summaryRows = [
      { Keterangan: 'Tanggal Laporan', Isi: formatLongDate(selectedDate) },
      { Keterangan: 'Total Tugas Terjadwal', Isi: totalTasks },
      { Keterangan: 'Tugas Selesai', Isi: completedTasks },
      { Keterangan: 'Persentase Selesai', Isi: `${completionPercentage}%` },
      { Keterangan: 'Ringkasan Pelaksanaan', Isi: reportSummary.trim() || '-' },
      { Keterangan: 'Kendala / Temuan', Isi: reportIssues.trim() || '-' },
      { Keterangan: 'Tindak Lanjut', Isi: reportFollowUp.trim() || '-' },
      { Keterangan: 'Petugas Pemeriksa', Isi: `${currentUser.name} (${roleLabel(currentUser.role)})` },
    ];

    exportMultiSheetExcel(
      [
        { sheetName: 'Rincian Tugas', data: detailRows },
        { sheetName: 'Ringkasan Laporan', data: summaryRows },
      ],
      `Laporan_Tugas_Harian_SPPG_${selectedDate}.xlsx`
    );
  };

  const handleExportPeriodExcel = () => {
    const dailyRows = periodReport.days.map((d, idx) => ({
      No: idx + 1,
      Tanggal: d.date,
      'Jumlah Tugas': d.total,
      Selesai: d.done,
      'Belum Selesai': d.pending,
      'Persentase (%)': d.total > 0 ? Math.round((d.done / d.total) * 100) : 0,
      'Ringkasan Laporan': d.summary || '-',
    }));

    const allRows = periodReport.list.map((t, idx) => ({
      No: idx + 1,
      Tanggal: t.date,
      'Target Jam': t.targetTime || '-',
      Kategori: t.category,
      'Uraian Tugas': t.title,
      Prioritas: t.priority,
      Status: t.isCompleted ? 'Selesai' : 'Belum selesai',
      'Jam Selesai': t.completedAt || '-',
      Pelaksana: t.completedBy || '-',
      'Hasil / Catatan': t.notes || '-',
    }));

    exportMultiSheetExcel(
      [
        { sheetName: 'Rekap Harian', data: dailyRows },
        { sheetName: 'Semua Tugas', data: allRows },
      ],
      `Rekap_Tugas_Harian_SPPG_${effectivePeriod.start}_sd_${effectivePeriod.end}.xlsx`
    );
  };

  const handleCopyWhatsappReport = async () => {
    const lines: string[] = [
      `*Laporan Tugas Harian SPPG*`,
      `Tanggal: ${formatLongDate(selectedDate)}`,
      `Progres: ${completedTasks}/${totalTasks} tugas selesai (${completionPercentage}%)`,
      '',
    ];
    todos.forEach((t, idx) => {
      const mark = t.isCompleted ? '[Selesai]' : '[Belum]';
      const timePart = t.completedAt ? ` (${t.completedAt} WIB)` : t.targetTime ? ` (target ${t.targetTime})` : '';
      lines.push(`${idx + 1}. ${mark} ${t.title}${timePart}`);
      if (t.notes) lines.push(`   Hasil: ${t.notes}`);
    });
    if (reportSummary.trim()) {
      lines.push('', `Ringkasan: ${reportSummary.trim()}`);
    }
    if (reportIssues.trim()) {
      lines.push(`Kendala: ${reportIssues.trim()}`);
    }
    if (reportFollowUp.trim()) {
      lines.push(`Tindak lanjut: ${reportFollowUp.trim()}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Ringkasan laporan disalin ke clipboard (siap ditempel ke WhatsApp).');
    } catch {
      toast.error('Gagal menyalin teks ke clipboard.');
    }
  };

  const tabs: { id: SubTab; label: string }[] = [
    { id: 'profile', label: 'Profil' },
    { id: 'todos', label: `Tugas harian (${completedTasks}/${totalTasks})` },
    { id: 'report', label: 'Laporan' },
  ];

  const dateControl = (
    <div className="flex flex-wrap items-center gap-2">
      <DateStepper ariaLabel="Tanggal tugas" value={selectedDate} onChange={handleDateChange} />
      {!isToday && (
        <button type="button" onClick={() => handleDateChange(todayStr)} className={BTN_SECONDARY}>
          Hari ini
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 12mm; }
          html, body { overflow: visible !important; height: auto !important; background: #ffffff !important; }
          body *:not(:has(#printable-report-area)):not(#printable-report-area):not(#printable-report-area *) { display: none !important; }
          body *:has(#printable-report-area) {
            position: static !important;
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
          }
          #printable-report-area {
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          #printable-report-area tr { break-inside: avoid; }
        }
      `}</style>

      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Profil & Tugas Harian</h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Nama dan kata sandi akun, daftar tugas operasional harian, laporan hasil pelaksanaan, dan rekap periode.
          </p>
        </div>
        <div role="tablist" aria-label="Bagian halaman profil" className="flex gap-1 p-1 bg-slate-100 rounded-lg text-xs overflow-x-auto max-w-full w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeSubTab === tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-3 rounded-md whitespace-nowrap cursor-pointer min-h-[44px] sm:min-h-[32px] ${FOCUS_RING} ${
                activeSubTab === tab.id ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===================== PROFIL ===================== */}
      {activeSubTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <form onSubmit={handleSaveProfile} className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Data akun</h2>

            {profileError && (
              <p role="alert" className="flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                {profileError}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="pf-email" className={FIELD_LABEL}>Email</label>
                <input id="pf-email" type="email" value={currentUser.email} disabled className={FIELD_INPUT} />
              </div>
              <div>
                <label htmlFor="pf-name" className={FIELD_LABEL}>Nama lengkap</label>
                <input
                  id="pf-name"
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={FIELD_INPUT}
                />
              </div>
            </div>

            <div>
              <span className={FIELD_LABEL}>Peran</span>
              <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">{roleLabel(currentUser.role)}</span>
                {ROLE_INFO[currentUser.role] && <> · {ROLE_INFO[currentUser.role].desc}</>}
                <p className="text-[11px] text-slate-600 mt-1">Peran hanya bisa diubah oleh Superadmin atau Kepala SPPG lewat Kelola Akun.</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-900">Ganti kata sandi</h3>
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-pressed={showPassword}
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:underline cursor-pointer rounded min-h-[44px] sm:min-h-0 ${FOCUS_RING}`}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="pf-cur" className={FIELD_LABEL}>Kata sandi saat ini</label>
                  <input
                    id="pf-cur"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className={FIELD_INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="pf-new" className={FIELD_LABEL}>Kata sandi baru</label>
                  <input
                    id="pf-new"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder={`Minimal ${MIN_PASSWORD} karakter`}
                    className={FIELD_INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="pf-confirm" className={FIELD_LABEL}>Ulangi kata sandi baru</label>
                  <input
                    id="pf-confirm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className={FIELD_INPUT}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-600">Biarkan kosong jika hanya mengubah nama.</p>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={isSavingProfile} className={BTN_PRIMARY}>
                {isSavingProfile ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </form>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-base shrink-0" aria-hidden="true">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{currentUser.name}</div>
                  <div className="text-xs text-slate-600 truncate">{currentUser.email}</div>
                </div>
              </div>
              <dl className="mt-4 pt-3 border-t border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-600">Peran</dt>
                  <dd className="font-semibold text-slate-900">{roleLabel(currentUser.role)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-600">ID akun</dt>
                  <dd className="font-mono text-slate-800 truncate">{currentUser.id}</dd>
                </div>
              </dl>
              {onNavigate && can('MANAGE_USERS') && (
                <button type="button" onClick={() => onNavigate('user_management')} className={`${BTN_SECONDARY} w-full mt-4`}>
                  <Users className="w-4 h-4" />
                  Kelola akun aplikasi
                </button>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold text-slate-900">Tugas hari ini</h2>
                <span className="text-xs font-semibold text-slate-700 font-mono tabular-nums">
                  {isToday ? `${completedTasks}/${totalTasks}` : '-'}
                </span>
              </div>
              {isToday && totalTasks > 0 && (
                <div className="w-full bg-slate-100 rounded-full h-2 mt-2" role="progressbar" aria-valuenow={completionPercentage} aria-valuemin={0} aria-valuemax={100}>
                  <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${completionPercentage}%` }} />
                </div>
              )}
              <p className="text-xs text-slate-600 mt-2">
                {!isToday
                  ? 'Buka tab Tugas harian untuk melihat tugas hari ini.'
                  : totalTasks === 0
                    ? 'Belum ada tugas harian untuk hari ini.'
                    : isAllCompleted
                      ? 'Semua tugas hari ini selesai.'
                      : `${totalTasks - completedTasks} tugas belum selesai.`}
              </p>
              <button
                type="button"
                onClick={() => {
                  handleDateChange(todayStr);
                  setActiveSubTab('todos');
                }}
                className={`${BTN_SECONDARY} w-full mt-3`}
              >
                Buka tugas harian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TUGAS HARIAN ===================== */}
      {activeSubTab === 'todos' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {dateControl}
              <div className="flex flex-wrap items-center gap-2">
                {totalTasks > 0 && (
                  <button
                    type="button"
                    onClick={handleClearDayTodos}
                    className={`${BTN_SECONDARY} ${BTN_GHOST} text-rose-700 hover:bg-rose-50`}
                    title="Hapus semua tugas pada tanggal ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Kosongkan
                  </button>
                )}
                {totalTasks === 0 && lastTodoDateBefore && (
                  <button
                    type="button"
                    onClick={handleCopyPreviousTodos}
                    className={BTN_SECONDARY}
                    title={`Salin daftar tugas dari ${formatLongDate(lastTodoDateBefore)}`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Salin dari {formatShortDate(lastTodoDateBefore)}
                  </button>
                )}
                <button type="button" onClick={handleResetTodos} className={BTN_SECONDARY} title="Muat 8 tugas standar operasional SPPG">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Tugas standar
                </button>
                <button type="button" onClick={openAddModal} className={BTN_PRIMARY}>
                  <Plus className="w-4 h-4" />
                  Tambah tugas
                </button>
              </div>
            </div>

            {totalTasks > 0 && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    className="w-auto"
                    aria-label="Filter status"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                  >
                    <option value="ALL">Semua status</option>
                    <option value="PENDING">Belum selesai</option>
                    <option value="COMPLETED">Sudah selesai</option>
                  </Select>
                  <Select
                    className="w-auto"
                    aria-label="Filter kategori"
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                  >
                    <option value="ALL">Semua kategori</option>
                    {categoryOptions.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                  <Select
                    className="w-auto"
                    aria-label="Filter pelaksana"
                    value={staffFilter}
                    onChange={e => setStaffFilter(e.target.value)}
                  >
                    <option value="ALL">Semua petugas</option>
                    <option value="ME">Tugas saya ({currentUser.name})</option>
                    {availableUsers?.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </Select>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between gap-2 text-xs mb-2">
                    <span className="text-slate-700">
                      <span className="font-semibold text-slate-900 tabular-nums">{completedTasks} dari {totalTasks}</span> selesai · {formatLongDate(selectedDate)}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">{completionPercentage}%</span>
                      <button
                        type="button"
                        onClick={() => {
                          setReportViewMode('DAILY');
                          setActiveSubTab('report');
                        }}
                        className={`text-xs font-semibold text-emerald-800 hover:underline cursor-pointer rounded ${FOCUS_RING}`}
                      >
                        Buka laporan
                      </button>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2" role="progressbar" aria-valuenow={completionPercentage} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-2 rounded-full bg-emerald-600 transition-all" style={{ width: `${completionPercentage}%` }} />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            {filteredTodos.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
                <ListTodo className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {totalTasks === 0 ? `Belum ada tugas untuk ${formatLongDate(selectedDate)}` : 'Tidak ada tugas yang cocok dengan filter.'}
                  </p>
                  {totalTasks === 0 && (
                    <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                      Buat daftar tugas harian Anda sendiri, lalu catat hasil pelaksanaannya agar langsung masuk ke laporan harian.
                    </p>
                  )}
                </div>
                {totalTasks === 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button type="button" onClick={openAddModal} className={BTN_PRIMARY}>
                      <Plus className="w-4 h-4" />
                      Tambah tugas
                    </button>
                    {lastTodoDateBefore && (
                      <button type="button" onClick={handleCopyPreviousTodos} className={BTN_SECONDARY}>
                        <Copy className="w-3.5 h-3.5" />
                        Salin dari {formatShortDate(lastTodoDateBefore)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              filteredTodos.map(todo => (
                <div
                  key={todo.id}
                  className={`rounded-xl border p-3 sm:p-4 flex items-start gap-3 ${
                    todo.isCompleted ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleTodo(todo.id)}
                    aria-pressed={todo.isCompleted}
                    aria-label={todo.isCompleted ? `Tandai belum selesai: ${todo.title}` : `Tandai selesai: ${todo.title}`}
                    className={`-m-2 p-2 rounded-lg shrink-0 cursor-pointer text-emerald-700 hover:bg-emerald-50 ${FOCUS_RING}`}
                  >
                    {todo.isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 fill-emerald-700 text-white" />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-400" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-semibold ${todo.isCompleted ? 'text-slate-600 line-through' : 'text-slate-900'}`}>
                      {todo.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {todo.targetTime && (
                        <span className={`${BADGE} bg-white text-slate-700 border-slate-200 font-mono tabular-nums`}>
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          {todo.targetTime}
                        </span>
                      )}
                      <span className={`${BADGE} bg-slate-100 text-slate-700 border-slate-200`}>{todo.category}</span>
                      <span className={`${BADGE} ${PRIORITY_TONE[todo.priority] || PRIORITY_TONE.Rendah}`}>Prioritas {todo.priority.toLowerCase()}</span>
                      {todo.session && todo.session !== 'Harian' && (
                        <span className={`${BADGE} bg-white text-slate-700 border-slate-200`}>{todo.session}</span>
                      )}
                      {todo.assignedUserName ? (
                        <span className={`${BADGE} bg-white text-slate-700 border-slate-200`}>
                          <Users className="w-3 h-3" aria-hidden="true" />
                          {todo.assignedUserName}
                        </span>
                      ) : todo.assignedRole && todo.assignedRole !== 'ALL' ? (
                        <span className={`${BADGE} bg-white text-slate-700 border-slate-200`}>{roleLabel(todo.assignedRole)}</span>
                      ) : null}
                    </div>
                    {todo.notes && (
                      <p className="text-xs text-slate-700 mt-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80">
                        <span className="font-semibold text-slate-800">Hasil / catatan:</span> {todo.notes}
                      </p>
                    )}
                    {todo.isCompleted && (
                      <p className="text-[11px] text-emerald-800 mt-1.5">
                        Selesai pukul <span className="font-mono">{todo.completedAt}</span>
                        {todo.completedBy && ` oleh ${todo.completedBy}`}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openTaskReportModal(todo)}
                      className={`inline-flex items-center gap-1 px-2 min-h-[44px] sm:min-h-[32px] rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 text-xs font-medium text-slate-700 cursor-pointer ${FOCUS_RING}`}
                      title="Catat hasil pelaksanaan dan status selesai untuk laporan"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{todo.isCompleted || todo.notes ? 'Hasil' : 'Lapor'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(todo)}
                      aria-label={`Ubah tugas: ${todo.title}`}
                      title="Ubah tugas"
                      className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer ${FOCUS_RING}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTodo(todo.id, todo.title)}
                      aria-label={`Hapus tugas: ${todo.title}`}
                      title="Hapus tugas"
                      className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer ${FOCUS_RING}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ===================== LAPORAN ===================== */}
      {activeSubTab === 'report' && (
        <div className="space-y-4">
          {/* Pilihan tampilan laporan: Harian vs Rekap periode */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div role="tablist" aria-label="Jenis laporan tugas" className="inline-flex gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                  {([
                    { id: 'DAILY', label: 'Laporan harian' },
                    { id: 'PERIOD', label: 'Rekap periode' },
                  ] as const).map(m => (
                    <button
                      key={m.id}
                      type="button"
                      role="tab"
                      aria-selected={reportViewMode === m.id}
                      onClick={() => setReportViewMode(m.id)}
                      className={`px-3 rounded-md cursor-pointer min-h-[40px] sm:min-h-[30px] ${FOCUS_RING} ${
                        reportViewMode === m.id ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {reportViewMode === 'DAILY' ? (
                  dateControl
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      aria-label="Rentang rekap"
                      value={periodPreset}
                      onChange={e => setPeriodPreset(e.target.value as PeriodPreset)}
                    >
                      <option value="LAST_7_DAYS">7 hari terakhir</option>
                      <option value="THIS_MONTH">Bulan ini</option>
                      <option value="CUSTOM">Pilih rentang…</option>
                    </Select>
                    {periodPreset === 'CUSTOM' && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <input
                          type="date"
                          aria-label="Dari tanggal"
                          value={periodStart}
                          onChange={e => setPeriodStart(e.target.value)}
                          className={`${FIELD_INPUT} w-auto`}
                        />
                        <span className="text-slate-600">s/d</span>
                        <input
                          type="date"
                          aria-label="Sampai tanggal"
                          value={periodEnd}
                          onChange={e => setPeriodEnd(e.target.value)}
                          className={`${FIELD_INPUT} w-auto`}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {reportViewMode === 'DAILY' && (
                  <button
                    type="button"
                    onClick={handleCopyWhatsappReport}
                    disabled={totalTasks === 0 && !reportSummary.trim()}
                    className={`${BTN_SECONDARY} disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Salin ringkasan laporan dalam format teks untuk WhatsApp"
                  >
                    <Copy className="w-4 h-4" />
                    Salin teks WA
                  </button>
                )}
                <button
                  type="button"
                  onClick={reportViewMode === 'DAILY' ? handleExportDailyExcel : handleExportPeriodExcel}
                  disabled={reportViewMode === 'DAILY' ? totalTasks === 0 : periodReport.total === 0}
                  className={`${BTN_SECONDARY} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Ekspor Excel
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={reportViewMode === 'DAILY' ? totalTasks === 0 && !reportSummary.trim() : periodReport.total === 0}
                  className={`${BTN_PRIMARY} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Printer className="w-4 h-4" />
                  Cetak / PDF
                </button>
              </div>
            </div>

            {reportViewMode === 'DAILY' && !isAllCompleted && totalTasks > 0 && (
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Baru {completedTasks} dari {totalTasks} tugas selesai ({completionPercentage}%). Laporan tetap bisa dicetak sebagai laporan sementara.
              </p>
            )}
          </div>

          {reportViewMode === 'DAILY' ? (
            <>
              {/* Catatan & ringkasan laporan harian (ikut masuk ke cetakan & Excel) */}
              <form onSubmit={handleSaveReportNote} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Ringkasan & Catatan Laporan Harian</h2>
                    <p className="text-[11px] text-slate-600">
                      Tercantum langsung di Berita Acara cetak, ekspor Excel, dan salinan WhatsApp tanggal {formatShortDate(selectedDate)}.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {reportNoteUpdatedBy && !isReportNoteDirty && (
                      <span className="text-[11px] text-emerald-800">Tersimpan oleh {reportNoteUpdatedBy}</span>
                    )}
                    <button type="submit" disabled={!isReportNoteDirty} className={`${BTN_PRIMARY} disabled:opacity-50`}>
                      <Save className="w-3.5 h-3.5" />
                      Simpan catatan
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="rep-summary" className={FIELD_LABEL}>Ringkasan pelaksanaan</label>
                    <textarea
                      id="rep-summary"
                      rows={2}
                      value={reportSummary}
                      onChange={e => {
                        setReportSummary(e.target.value);
                        setIsReportNoteDirty(true);
                      }}
                      placeholder="Contoh: Seluruh kegiatan penerimaan bahan dan persiapan berjalan sesuai jadwal."
                      className={`${FIELD_INPUT} py-2`}
                    />
                  </div>
                  <div>
                    <label htmlFor="rep-issues" className={FIELD_LABEL}>Kendala / temuan (opsional)</label>
                    <textarea
                      id="rep-issues"
                      rows={2}
                      value={reportIssues}
                      onChange={e => {
                        setReportIssues(e.target.value);
                        setIsReportNoteDirty(true);
                      }}
                      placeholder="Contoh: Pengiriman sayur terlambat 20 menit karena hujan."
                      className={`${FIELD_INPUT} py-2`}
                    />
                  </div>
                  <div>
                    <label htmlFor="rep-followup" className={FIELD_LABEL}>Tindak lanjut (opsional)</label>
                    <textarea
                      id="rep-followup"
                      rows={2}
                      value={reportFollowUp}
                      onChange={e => {
                        setReportFollowUp(e.target.value);
                        setIsReportNoteDirty(true);
                      }}
                      placeholder="Contoh: Konfirmasi ulang jadwal kirim supplier untuk besok."
                      className={`${FIELD_INPUT} py-2`}
                    />
                  </div>
                </div>
              </form>

              {/* Dokumen Berita Acara Harian (siap cetak) */}
              <div id="printable-report-area" className="bg-white rounded-xl border border-slate-200 p-4 sm:p-8 overflow-x-auto">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4 border-b-2 border-slate-800 pb-5 mb-6">
                  <div className="flex items-start gap-4">
                    <SppgLogo size="lg" variant="color" showText={false} />
                    <KopText />
                  </div>
                  <div className="sm:text-right text-xs">
                    <div className="font-bold text-slate-900">Berita Acara Laporan Tugas Harian</div>
                    <div className="font-mono text-slate-600 text-[11px] mt-0.5">
                      No. BA-SPPG/{selectedDate.replace(/-/g, '')}/01
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1">
                      Tanggal: <strong className="text-slate-800">{formatLongDate(selectedDate)}</strong>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: 'Tugas terjadwal', value: `${totalTasks}` },
                    { label: 'Tugas selesai', value: `${completedTasks}` },
                    { label: 'Persentase selesai', value: `${completionPercentage}%` },
                    { label: 'Selesai terakhir', value: lastCompletedAt ? `Pukul ${lastCompletedAt}` : '-' },
                  ].map(m => (
                    <div key={m.label} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-[11px] text-slate-600">{m.label}</div>
                      <div className="text-lg font-bold text-slate-900 mt-0.5 font-mono tabular-nums">{m.value}</div>
                    </div>
                  ))}
                </div>

                {categoryBreakdown.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-5 text-xs">
                    {categoryBreakdown.map(c => (
                      <span key={c.category} className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-700">
                        {c.category}: <strong className="font-mono tabular-nums text-slate-900">{c.done}/{c.total}</strong>
                      </span>
                    ))}
                  </div>
                )}

                <table className="w-full min-w-[640px] text-left text-xs border border-slate-200 mb-6">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">No</th>
                      <th className="py-2.5 px-3 w-36">Kategori & jam</th>
                      <th className="py-2.5 px-3">Uraian tugas</th>
                      <th className="py-2.5 px-3">Hasil / catatan</th>
                      <th className="py-2.5 px-3 w-20 text-center">Status</th>
                      <th className="py-2.5 px-3 w-24">Jam selesai</th>
                      <th className="py-2.5 px-3 w-36">Pelaksana</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {todos.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-600">Belum ada tugas untuk tanggal ini.</td>
                      </tr>
                    ) : (
                      todos.map((todo, idx) => (
                        <tr key={todo.id}>
                          <td className="py-2 px-3 text-center text-slate-600 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-800">{todo.category}</div>
                            <div className="text-[11px] text-slate-600 font-mono">{todo.targetTime || todo.session || 'Harian'}</div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-medium text-slate-900">{todo.title}</div>
                            <div className="text-[11px] text-slate-500">Prioritas {todo.priority.toLowerCase()}</div>
                          </td>
                          <td className="py-2 px-3 text-slate-700">{todo.notes || '-'}</td>
                          <td className="py-2 px-3 text-center font-semibold">
                            {todo.isCompleted ? <span className="text-emerald-800">Selesai</span> : <span className="text-slate-600">Belum</span>}
                          </td>
                          <td className="py-2 px-3 text-slate-700 font-mono tabular-nums">{todo.completedAt ? `${todo.completedAt} WIB` : '-'}</td>
                          <td className="py-2 px-3 text-slate-700">
                            <div className="font-semibold">{todo.completedBy || '-'}</div>
                            {todo.assignedUserName && <div className="text-[11px] text-slate-600">Ditugaskan: {todo.assignedUserName}</div>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {(reportSummary.trim() || reportIssues.trim() || reportFollowUp.trim()) && (
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 mb-6 text-xs space-y-2">
                    {reportSummary.trim() && (
                      <div>
                        <span className="font-semibold text-slate-900">Ringkasan pelaksanaan: </span>
                        <span className="text-slate-700">{reportSummary.trim()}</span>
                      </div>
                    )}
                    {reportIssues.trim() && (
                      <div>
                        <span className="font-semibold text-slate-900">Kendala / temuan: </span>
                        <span className="text-slate-700">{reportIssues.trim()}</span>
                      </div>
                    )}
                    {reportFollowUp.trim() && (
                      <div>
                        <span className="font-semibold text-slate-900">Tindak lanjut: </span>
                        <span className="text-slate-700">{reportFollowUp.trim()}</span>
                      </div>
                    )}
                  </div>
                )}

                <p className="border border-slate-200 rounded-lg p-4 bg-slate-50 mb-8 text-xs text-slate-700 leading-relaxed">
                  <strong className="text-slate-900">Pernyataan:</strong> butir tugas di atas telah diperiksa dan dikerjakan sesuai penugasan operasional harian SPPG.
                </p>

                <DocSignatureToggle doc="laporan-tugas" />
                <div className="grid grid-cols-2 gap-8 pt-4 text-center text-xs">
                  <div>
                    <p className="text-slate-600">Petugas yang memeriksa,</p>
                    <div className="h-16" />
                    <p className="font-bold text-slate-900 underline">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-600">{roleLabel(currentUser.role)}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Mengetahui & menyetujui,</p>
                    <div className="h-20 flex items-center justify-center"><OfficerSignatureImg doc="laporan-tugas" officer="KEPALA_SPPG" /></div>
                    <p className="font-bold text-slate-900 underline">{signerName('KEPALA_SPPG')}</p>
                    <p className="text-[11px] text-slate-600">Kepala SPPG Malang Tumpang Jeru</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Rekap Periode (siap cetak & ekspor) */
            <div id="printable-report-area" className="bg-white rounded-xl border border-slate-200 p-4 sm:p-8 overflow-x-auto space-y-6">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4 border-b-2 border-slate-800 pb-5">
                <div className="flex items-start gap-4">
                  <SppgLogo size="lg" variant="color" showText={false} />
                  <KopText />
                </div>
                <div className="sm:text-right text-xs">
                  <div className="font-bold text-slate-900">Rekapitulasi Laporan Tugas Harian</div>
                  <div className="text-[11px] text-slate-600 mt-1">
                    Periode: <strong className="text-slate-800">{formatShortDate(effectivePeriod.start)} s/d {formatShortDate(effectivePeriod.end)}</strong>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total tugas periode', value: `${periodReport.total}` },
                  { label: 'Total selesai', value: `${periodReport.done}` },
                  { label: 'Tingkat selesai', value: `${periodReport.pct}%` },
                  { label: 'Hari tercatat', value: `${periodReport.days.length} hari` },
                ].map(m => (
                  <div key={m.label} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-[11px] text-slate-600">{m.label}</div>
                    <div className="text-lg font-bold text-slate-900 mt-0.5 font-mono tabular-nums">{m.value}</div>
                  </div>
                ))}
              </div>

              {periodReport.categories.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {periodReport.categories.map(c => (
                    <span key={c.category} className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-700">
                      {c.category}: <strong className="font-mono tabular-nums text-slate-900">{c.done}/{c.total}</strong>
                    </span>
                  ))}
                </div>
              )}

              <table className="w-full min-w-[560px] text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-44">Tanggal</th>
                    <th className="py-2.5 px-3 w-24 text-right">Tugas</th>
                    <th className="py-2.5 px-3 w-24 text-right">Selesai</th>
                    <th className="py-2.5 px-3 w-24 text-right">Capaian</th>
                    <th className="py-2.5 px-3">Ringkasan laporan</th>
                    <th className="py-2.5 px-3 w-24 text-right print:hidden">Rincian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {periodReport.days.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-600">
                        Belum ada tugas harian tercatat pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    periodReport.days.map(d => {
                      const pct = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
                      return (
                        <tr key={d.date}>
                          <td className="py-2.5 px-3 font-medium text-slate-900">{formatLongDate(d.date)}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">{d.total}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-800 font-semibold">{d.done}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">{pct}%</td>
                          <td className="py-2.5 px-3 text-slate-700">{d.summary || '-'}</td>
                          <td className="py-2.5 px-3 text-right print:hidden">
                            <button
                              type="button"
                              onClick={() => {
                                handleDateChange(d.date);
                                setReportViewMode('DAILY');
                              }}
                              className={`text-xs font-semibold text-emerald-800 hover:underline cursor-pointer rounded ${FOCUS_RING}`}
                            >
                              Buka
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Tambah / Ubah Tugas */}
      {isTaskModalOpen && (
        <FormDialog
          title={editingTodoId ? 'Ubah tugas harian' : 'Tambah tugas harian'}
          description={formatLongDate(selectedDate)}
          onClose={() => {
            setIsTaskModalOpen(false);
            setEditingTodoId(null);
          }}
          onSubmit={handleSaveTaskModal}
          submitLabel={editingTodoId ? 'Simpan perubahan' : 'Simpan tugas'}
          error={taskError}
        >
          <div>
            <label htmlFor="td-title" className={FIELD_LABEL}>Uraian tugas</label>
            <input
              id="td-title"
              type="text"
              required
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="Contoh: Kalibrasi timbangan digital sebelum penerimaan bahan"
              className={FIELD_INPUT}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="td-cat" className={FIELD_LABEL}>Kategori</label>
              <Select className="w-full" id="td-cat" value={formCategory} onChange={e => setFormCategory(e.target.value as TodoCategory)}>
                {TODO_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="td-prio" className={FIELD_LABEL}>Prioritas</label>
              <Select className="w-full" id="td-prio" value={formPriority} onChange={e => setFormPriority(e.target.value as TodoPriority)}>
                <option value="Tinggi">Tinggi</option>
                <option value="Sedang">Sedang</option>
                <option value="Rendah">Rendah</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="td-time" className={FIELD_LABEL}>Target jam</label>
              <input id="td-time" type="time" value={formTargetTime} onChange={e => setFormTargetTime(e.target.value)} className={`${FIELD_INPUT} font-mono`} />
            </div>
            <div>
              <label htmlFor="td-session" className={FIELD_LABEL}>Sesi</label>
              <Select className="w-full" id="td-session" value={formSession} onChange={e => setFormSession(e.target.value as typeof formSession)}>
                <option value="Pagi">Pagi (05.00–09.00)</option>
                <option value="Siang">Siang (09.00–14.00)</option>
                <option value="Sore">Sore (14.00–18.00)</option>
                <option value="Harian">Kapan saja</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="td-user" className={FIELD_LABEL}>Tugaskan ke orang</label>
              <Select className="w-full" id="td-user" value={formAssignedUserId} onChange={e => setFormAssignedUserId(e.target.value)}>
                <option value="">Tidak spesifik</option>
                {availableUsers?.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({roleLabel(u.role)})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="td-role" className={FIELD_LABEL}>Atau ke peran</label>
              <Select
                className="w-full"
                id="td-role"
                value={formAssignedRole}
                disabled={Boolean(formAssignedUserId)}
                onChange={e => setFormAssignedRole(e.target.value as UserRole | 'ALL')}
              >
                <option value="ALL">Semua petugas</option>
                {(Object.keys(ROLE_INFO) as UserRole[]).map(r => (
                  <option key={r} value={r}>{ROLE_INFO[r].label}</option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <label htmlFor="td-notes" className={FIELD_LABEL}>Catatan / hasil pelaksanaan (opsional)</label>
            <textarea
              id="td-notes"
              rows={2}
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              placeholder="Parameter pemeriksaan, hasil realisasi, atau kendala di lapangan."
              className={`${FIELD_INPUT} py-2`}
            />
          </div>
        </FormDialog>
      )}

      {/* Modal Lapor Hasil per Tugas */}
      {reportingTodo && (
        <FormDialog
          title="Laporan hasil tugas"
          description={reportingTodo.title}
          onClose={() => setReportingTodo(null)}
          onSubmit={handleSaveTaskReport}
          submitLabel="Simpan hasil"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer min-h-[44px] sm:min-h-0">
              <input
                type="checkbox"
                checked={reportTaskCompleted}
                onChange={e => setReportTaskCompleted(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-700 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-600"
              />
              Tandai tugas sudah selesai
            </label>
            {reportTaskCompleted && (
              <div>
                <label htmlFor="rep-task-time" className={FIELD_LABEL}>Jam selesai</label>
                <input
                  id="rep-task-time"
                  type="time"
                  value={reportTaskTime}
                  onChange={e => setReportTaskTime(e.target.value)}
                  className={`${FIELD_INPUT} font-mono`}
                />
              </div>
            )}
          </div>
          <div>
            <label htmlFor="rep-task-notes" className={FIELD_LABEL}>Hasil pelaksanaan / temuan</label>
            <textarea
              id="rep-task-notes"
              rows={3}
              autoFocus
              value={reportTaskNotes}
              onChange={e => setReportTaskNotes(e.target.value)}
              placeholder="Contoh: Semua 5 supplier sudah ditimbang dan dicek mutunya, suhu penyimpanan normal."
              className={`${FIELD_INPUT} py-2`}
            />
            <p className="text-[11px] text-slate-600 mt-1">
              Otomatis muncul di kolom Hasil / catatan pada Berita Acara Laporan Harian dan ekspor Excel.
            </p>
          </div>
        </FormDialog>
      )}
    </div>
  );
};
