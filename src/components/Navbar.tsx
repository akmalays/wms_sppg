import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/warehouse';
import { SppgLogo } from './SppgLogo';
import {
  LayoutDashboard,
  TrendingDown,
  Package,
  Boxes,
  Receipt,
  UtensilsCrossed,
  Trash2,
  Printer,
  ChevronDown,
  Truck,
  History,
  ClipboardCheck,
  Wrench,
  Building2,
  ShieldAlert,
  RotateCcw,
  LogOut,
  User,
  UserCheck,
  Utensils,
  Users,
  PackagePlus,
  Calendar,
  Clock,
  UserPlus,
  Menu,
  X,
  CheckCircle2,
  ChevronRight,
  Award,
  Globe,
  ExternalLink
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onResetData: () => void;
  onClearTransactions?: () => void;
  onViewLanding?: () => void;
}

const ROLE_OPTIONS: {
  role: UserRole;
  label: string;
  shortLabel: string;
  defaultUserName: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}[] = [
  {
    role: 'SUPERADMIN',
    label: 'Superadmin',
    shortLabel: 'Superadmin',
    defaultUserName: 'Budi Santoso',
    description: 'Akses penuh seluruh modul, audit trail & otorisasi',
    icon: ShieldAlert,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-700',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200',
  },
  {
    role: 'KA_SPPG',
    label: 'Kepala SPPG (Ka SPPG)',
    shortLabel: 'Ka SPPG',
    defaultUserName: 'Rizky Iman Ramdhan',
    description: 'Persetujuan belanja, validasi PO & pengawasan',
    icon: Award,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-700',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
  },
  {
    role: 'ADMIN',
    label: 'Admin Pergudangan',
    shortLabel: 'Admin',
    defaultUserName: 'Akmal',
    description: 'Input bahan, stok opname, katalog & laporan harian',
    icon: Package,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
  },
  {
    role: 'ASLAP',
    label: 'Asisten Lapangan (Aslap)',
    shortLabel: 'Aslap',
    defaultUserName: 'Andi Pratama',
    description: 'Penerimaan fisik petani/mitra & uji organoleptik',
    icon: Truck,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-800',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
  },
  {
    role: 'AKUNTAN',
    label: 'Akuntan & Kasir',
    shortLabel: 'Akuntan',
    defaultUserName: 'Dewi Lestari',
    description: 'Buku kas, SPJ nota belanja riil & rekonsiliasi',
    icon: Receipt,
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-700',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-700',
    badgeBorder: 'border-teal-200',
  },
];

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab, onResetData, onClearTransactions, onViewLanding }) => {
  const { currentUser, switchUser, logout } = useAuth();
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isResetMenuOpen, setIsResetMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const resetMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
      if (resetMenuRef.current && !resetMenuRef.current.contains(event.target as Node)) {
        setIsResetMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsRoleDropdownOpen(false);
        setIsMoreOpen(false);
        setIsResetMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Realtime Live Clock & Date
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const monthNamesLong = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthNamesShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
  ];

  const dayName = dayNames[currentDateTime.getDay()];
  const dateNum = currentDateTime.getDate();
  const monthLong = monthNamesLong[currentDateTime.getMonth()];
  const monthShort = monthNamesShort[currentDateTime.getMonth()];
  const year = currentDateTime.getFullYear();

  const fullDateString = `${dayName}, ${dateNum} ${monthLong} ${year}`;
  const shortDateString = `${dayName}, ${dateNum} ${monthShort} ${year}`;

  const hours = String(currentDateTime.getHours()).padStart(2, '0');
  const minutes = String(currentDateTime.getMinutes()).padStart(2, '0');
  const seconds = String(currentDateTime.getSeconds()).padStart(2, '0');
  const formattedTime = `${hours}:${minutes}:${seconds} WIB`;

  const primaryNavItems = [
    { id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard },
    { id: 'menu_orders', label: 'Menu & Penerima Manfaat', icon: UtensilsCrossed },
    { id: 'receiving', label: 'Input Barang & Belanja', icon: PackagePlus },
    { id: 'daily_expenses', label: 'Laporan Pengeluaran', icon: TrendingDown },
    { id: 'inventory', label: 'Stok Barang', icon: Boxes },
    { id: 'waste_logs', label: 'Rekap Limbah', icon: Trash2 },
    { id: 'employees', label: 'Karyawan & Absensi', icon: Users },
    { id: 'profile', label: 'Profil & Checklist', icon: UserCheck },
    { id: 'tools_forms', label: 'Cetak Form', icon: Printer },
  ];

  const secondaryNavItems = [
    { id: 'website_cms', label: 'Atur Website', icon: Globe },
    { id: 'daily_flow', label: 'Aliran Stok Harian (Daily-Flow)', icon: Utensils },
    { id: 'ledger', label: 'Buku Mutasi (Ledger)', icon: History },
    { id: 'equipment', label: 'Inventaris Aset Dapur', icon: Wrench },
    { id: 'suppliers', label: 'Manajemen Rekanan Supplier', icon: Building2 },
    { id: 'user_management', label: 'Kelola & Buat User Baru', icon: UserPlus },
    { id: 'audit', label: 'Audit Trail & Keamanan', icon: ShieldAlert },
  ];

  const isSecondaryActive = secondaryNavItems.some(item => item.id === activeTab);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Authentic SPPG Vector Logo & Title + Realtime Date & Clock */}
          <div className="flex items-center gap-3 sm:gap-4">
            <SppgLogo size="md" variant="color" />

            {/* Subtle Divider */}
            <div className="hidden sm:block h-7 w-px bg-slate-200" />

            {/* Tanggal & Jam Realtime */}
            <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="hidden xl:inline">{fullDateString}</span>
                <span className="xl:hidden">{shortDateString}</span>
              </div>
              <div className="h-3 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5 text-xs text-slate-900 font-mono font-bold">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{formattedTime}</span>
              </div>
            </div>
          </div>

          {/* Right Controls: Role Switcher, Reset, Logout */}
          <div className="flex items-center gap-2.5">
            {/* Custom Petugas & Role Switcher Dropdown */}
            {(() => {
              const currentRoleInfo = ROLE_OPTIONS.find(r => r.role === currentUser.role) || ROLE_OPTIONS[2];

              return (
                <div className="relative" ref={roleDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                    className={`flex items-center gap-2 p-1.5 pl-2 pr-2.5 rounded-xl border transition-all cursor-pointer ${
                      isRoleDropdownOpen
                        ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100/90 border-slate-200 shadow-2xs'
                    }`}
                    aria-expanded={isRoleDropdownOpen}
                    aria-haspopup="true"
                    title="Ganti peran pengguna (RBAC) atau buka profil petugas"
                  >
                    {/* Avatar Initial */}
                    <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                      {currentUser.name.charAt(0)}
                    </div>

                    {/* Info Petugas & Role Badge */}
                    <div className="text-left hidden xl:block">
                      <div className="flex items-center gap-1.5 leading-none">
                        <span className="text-[10px] font-medium text-slate-500">Petugas</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${currentRoleInfo.badgeBg} ${currentRoleInfo.badgeText} border ${currentRoleInfo.badgeBorder} leading-none`}>
                          {currentRoleInfo.shortLabel}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 leading-tight mt-0.5 truncate max-w-[120px]">
                        {currentUser.name}
                      </div>
                    </div>

                    {/* Chevron Down Icon */}
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                        isRoleDropdownOpen ? 'rotate-180 text-emerald-600' : ''
                      }`}
                    />
                  </button>

                  {/* Custom Dropdown Menu Panel */}
                  {isRoleDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                      {/* Header Profil Singkat */}
                      <div className="p-3.5 bg-gradient-to-r from-[#0c3123] to-[#164e37] text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                            {currentUser.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm text-white truncate leading-tight">
                              {currentUser.name}
                            </div>
                            <div className="text-[11px] text-emerald-200 truncate mt-0.5">
                              {currentUser.email}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-white/15 flex items-center justify-between text-[11px]">
                          <span className="text-emerald-200/90 font-medium">Peran Aktif:</span>
                          <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {currentRoleInfo.label}
                          </span>
                        </div>
                      </div>

                      {/* Daftar Pilihan Peran (RBAC) */}
                      <div className="p-2">
                        <div className="px-2.5 py-1 text-[11px] font-bold text-slate-600">
                          Ganti Peran Petugas (RBAC)
                        </div>

                        <div className="space-y-1 mt-1">
                          {ROLE_OPTIONS.map(opt => {
                            const isSelected = opt.role === currentUser.role;
                            const Icon = opt.icon;

                            return (
                              <button
                                key={opt.role}
                                type="button"
                                onClick={() => {
                                  switchUser(opt.role);
                                  setIsRoleDropdownOpen(false);
                                }}
                                className={`w-full text-left p-2 rounded-xl transition-all flex items-start gap-2.5 cursor-pointer border ${
                                  isSelected
                                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-semibold shadow-2xs'
                                    : 'bg-white hover:bg-slate-50 border-transparent text-slate-700'
                                }`}
                              >
                                <div className={`p-2 rounded-lg ${opt.iconBg} ${opt.iconColor} shrink-0 mt-0.5`}>
                                  <Icon className="w-4 h-4" />
                                </div>

                                <div className="flex-1 min-w-0 pr-1">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className={`text-xs ${isSelected ? 'font-bold text-emerald-950' : 'font-semibold text-slate-900'}`}>
                                      {opt.label}
                                    </span>
                                    {isSelected && (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                                    {opt.description}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Footer Shortcut ke Halaman Profil */}
                      <div className="p-2 border-t border-slate-100 bg-slate-50/60">
                        <button
                          type="button"
                          onClick={() => {
                            setIsRoleDropdownOpen(false);
                            onSelectTab('profile');
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-emerald-800 hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer shadow-2xs"
                        >
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-emerald-600" />
                            <span>Buka Profil & Checklist Tugas</span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Database Management / Reset Menu */}
            <div className="relative" ref={resetMenuRef}>
              <button
                type="button"
                onClick={() => setIsResetMenuOpen(!isResetMenuOpen)}
                title="Kelola Database (Bersihkan transaksi / Reset demo)"
                className={`p-2 rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center ${
                  isResetMenuOpen
                    ? 'bg-slate-200 text-slate-900'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {isResetMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-[#ded7c8] rounded-xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 py-1 text-[11px] font-bold text-[#65766e]">
                    Pembersihan & Reset Database
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMenuOpen(false);
                      if (onClearTransactions) onClearTransactions();
                    }}
                    className="w-full text-left px-3 py-2.5 text-xs hover:bg-amber-50/80 transition-colors flex items-start gap-2.5 cursor-pointer group"
                  >
                    <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-200 shrink-0 mt-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 group-hover:text-amber-900">
                        Bersihkan Data Transaksi
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                        Kosongkan riwayat belanja, PO, pengeluaran & nolkan stok. Master barang & akun tetap aman.
                      </div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMenuOpen(false);
                      onResetData();
                    }}
                    className="w-full text-left px-3 py-2.5 text-xs hover:bg-rose-50/80 transition-colors flex items-start gap-2.5 cursor-pointer group"
                  >
                    <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 group-hover:bg-rose-200 shrink-0 mt-0.5">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 group-hover:text-rose-900">
                        Reset ke Data Demo Bawaan
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                        Muat ulang seluruh data sampel simulasi demo SPPG dari awal.
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              title="Keluar dari sistem"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-rose-700 hover:bg-rose-50/50 hover:border-rose-200 border border-slate-200 rounded-lg transition-colors cursor-pointer min-h-[36px]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>

            {/* Mobile Navigation Drawer Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-800 hover:bg-slate-100 border border-slate-200 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label={isMobileMenuOpen ? 'Tutup navigasi menu' : 'Buka navigasi menu'}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar for Desktop & Tablet */}
      <div className="hidden md:block border-t border-slate-200 bg-slate-50/90 relative z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between py-1.5 gap-3">
          {/* Scrollable primary nav items */}
          <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none py-0.5 min-w-0 flex-1">
            {primaryNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    isActive
                      ? 'bg-white text-emerald-800 shadow-2xs border border-slate-200 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-600' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Dropdown for Secondary / Deep Modules (OUTSIDE of overflow container) */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer shadow-2xs border ${
                isSecondaryActive
                  ? 'bg-white text-emerald-800 border-slate-200 shadow-2xs font-semibold'
                  : isMoreOpen
                  ? 'bg-slate-200 text-slate-900 border-slate-300'
                  : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-100 border-slate-200 font-medium'
              }`}
            >
              <span>Modul Lainnya</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isMoreOpen ? 'rotate-180 text-emerald-600' : isSecondaryActive ? 'text-emerald-600' : 'text-slate-500'}`} />
            </button>

            {isMoreOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-3.5 py-1 text-[11px] font-semibold text-slate-500">
                  Modul Lainnya
                </div>
                <div className="py-1">
                  {secondaryNavItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectTab(item.id);
                          setIsMoreOpen(false);
                        }}
                        className={`w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-xs transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-900 font-bold border-l-2 border-emerald-600'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-500'}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                {onViewLanding && (
                  <div className="pt-2 mt-1 border-t border-slate-100 px-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreOpen(false);
                        onViewLanding();
                      }}
                      className="w-full text-left flex items-center justify-between px-3 py-2 text-xs text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100/70 rounded-xl transition-colors cursor-pointer font-semibold group border border-emerald-200"
                    >
                      <span className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-emerald-600" />
                        <span>Ke Website</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Responsive Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-150 max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <div className="text-[11px] font-bold text-slate-600 mb-2 px-1">
                Modul Utama Operasional
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {primaryNavItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold cursor-pointer min-h-[44px] transition-colors ${
                        isActive
                          ? 'bg-white text-emerald-800 border border-slate-200 shadow-2xs font-semibold'
                          : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <div className="text-[11px] font-bold text-slate-600 mb-2 px-1">
                Modul Lainnya
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {secondaryNavItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold cursor-pointer min-h-[44px] transition-colors ${
                        isActive
                          ? 'bg-white text-emerald-800 border border-slate-200 shadow-2xs font-semibold'
                          : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions (Mobile) */}
            <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
              {onViewLanding && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onViewLanding();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-200 cursor-pointer min-h-[44px]"
                >
                  <span className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Ke Website</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                </button>
              )}
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 cursor-pointer min-h-[44px]"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Keluar dari Akun</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
