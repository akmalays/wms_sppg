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

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab, onResetData, onClearTransactions, onViewLanding }) => {
  const { currentUser, switchUser, logout } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isResetMenuOpen, setIsResetMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const resetMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
      if (resetMenuRef.current && !resetMenuRef.current.contains(event.target as Node)) {
        setIsResetMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    { id: 'menu_print', label: 'Cetak Menu MBG', icon: Printer },
    { id: 'nonfood_expenses', label: 'Pengeluaran Non-Food', icon: Receipt },
    { id: 'daily_flow', label: 'Aliran Stok Harian (Daily-Flow)', icon: Utensils },
    { id: 'ledger', label: 'Buku Mutasi (Ledger)', icon: History },
    { id: 'stock_opname', label: 'Stock Opname Fisik', icon: ClipboardCheck },
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
                <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
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
            {/* User Profile Quick Link & Role Switcher */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 px-2.5">
              <button
                type="button"
                onClick={() => onSelectTab('profile')}
                className="flex items-center gap-1.5 text-left hover:text-blue-600 transition-colors cursor-pointer group"
                title="Buka Menu Profil & Pengaturan Akun"
              >
                <div className="w-6 h-6 rounded-full bg-blue-100 group-hover:bg-blue-200 text-blue-800 flex items-center justify-center font-bold text-xs shrink-0 transition-colors">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden xl:block">
                  <div className="text-[10px] font-medium text-slate-500 group-hover:text-blue-600 leading-none">Petugas</div>
                  <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 leading-tight truncate max-w-[120px]">{currentUser.name}</div>
                </div>
              </button>
              <select
                value={currentUser.role}
                onChange={e => switchUser(e.target.value as UserRole)}
                className="text-xs font-semibold rounded border border-slate-200 bg-white px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                title="Ganti peran pengguna (RBAC)"
              >
                <option value="SUPERADMIN">Superadmin</option>
                <option value="KA_SPPG">Ka SPPG</option>
                <option value="ADMIN">Admin</option>
                <option value="ASLAP">Aslap</option>
                <option value="AKUNTAN">Akuntan</option>
              </select>
            </div>

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
              className="lg:hidden p-2 rounded-lg text-slate-800 hover:bg-slate-100 border border-slate-200 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-blue-600"
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isActive
                      ? 'bg-[#0f172a] text-white border border-[#0f172a] shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 font-medium'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
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
                  ? 'bg-[#0f172a] text-white border-[#0f172a] shadow-xs font-bold'
                  : isMoreOpen
                  ? 'bg-slate-200 text-slate-900 border-slate-300'
                  : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-100 border-slate-200 font-medium'
              }`}
            >
              <span>Modul Lainnya</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isMoreOpen ? 'rotate-180 text-cyan-500' : 'text-slate-500'}`} />
            </button>

            {isMoreOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-3.5 py-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
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
                            ? 'bg-blue-50 text-blue-900 font-bold border-l-2 border-blue-600'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
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
                      className="w-full text-left flex items-center justify-between px-3 py-2 text-xs text-blue-700 bg-blue-50/70 hover:bg-blue-100/70 rounded-xl transition-colors cursor-pointer font-semibold group border border-blue-100"
                    >
                      <span className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-600" />
                        <span>Ke Website</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
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
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold'
                          : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-500'}`} />
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
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold'
                          : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-500'}`} />
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
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50/50 hover:bg-blue-50 border border-blue-200 cursor-pointer min-h-[44px]"
                >
                  <span className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Ke Website</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
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
