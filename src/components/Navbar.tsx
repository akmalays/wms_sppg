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
  Clock
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onResetData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab, onResetData }) => {
  const { currentUser, switchUser, logout } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
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
    { id: 'receiving', label: 'Input Barang & Belanja', icon: PackagePlus },
    { id: 'daily_expenses', label: 'Laporan Pengeluaran', icon: TrendingDown },
    { id: 'inventory', label: 'Stok Barang', icon: Boxes },
    { id: 'menu_orders', label: 'Order Menu Gizi', icon: UtensilsCrossed },
    { id: 'waste_logs', label: 'Rekap Limbah', icon: Trash2 },
    { id: 'employees', label: 'Karyawan & Absensi', icon: Users },
    { id: 'profile', label: 'Profil & Checklist', icon: UserCheck },
    { id: 'tools_forms', label: 'Cetak Form', icon: Printer },
  ];

  const secondaryNavItems = [
    { id: 'menu_print', label: 'Cetak Menu MBG', icon: Printer },
    { id: 'nonfood_expenses', label: 'Pengeluaran Non-Food', icon: Receipt },
    { id: 'daily_flow', label: 'Aliran Stok Harian (Daily-Flow)', icon: Utensils },
    { id: 'ledger', label: 'Buku Mutasi (Ledger)', icon: History },
    { id: 'stock_opname', label: 'Stock Opname Fisik', icon: ClipboardCheck },
    { id: 'equipment', label: 'Inventaris Aset Dapur', icon: Wrench },
    { id: 'suppliers', label: 'Manajemen Rekanan Supplier', icon: Building2 },
    { id: 'audit', label: 'Audit Trail & Keamanan', icon: ShieldAlert },
  ];

  const isSecondaryActive = secondaryNavItems.some(item => item.id === activeTab);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-2xs">
      {/* Top Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Authentic SPPG Vector Logo & Title + Realtime Date & Clock */}
          <div className="flex items-center gap-3 sm:gap-4">
            <SppgLogo size="md" variant="color" />

            {/* Subtle Divider */}
            <div className="hidden sm:block h-7 w-px bg-slate-200" />

            {/* Tanggal & Jam Realtime */}
            <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50/90 border border-slate-200/90 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="hidden xl:inline">{fullDateString}</span>
                <span className="xl:hidden">{shortDateString}</span>
              </div>
              <div className="h-3 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5 text-xs text-slate-800 font-mono font-bold">
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
                className="flex items-center gap-1.5 text-left hover:text-emerald-700 transition-colors cursor-pointer group"
                title="Buka Menu Profil & Pengaturan Akun"
              >
                <div className="w-6 h-6 rounded-full bg-emerald-100 group-hover:bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0 transition-colors">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden xl:block">
                  <div className="text-[10px] font-medium text-slate-400 group-hover:text-emerald-600 leading-none">Profil Saya</div>
                  <div className="text-xs font-semibold text-slate-800 group-hover:text-emerald-800 leading-tight truncate max-w-[120px]">{currentUser.name}</div>
                </div>
              </button>
              <select
                value={currentUser.role}
                onChange={e => switchUser(e.target.value as UserRole)}
                className="text-xs font-semibold rounded border border-slate-200 bg-white px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                title="Ganti peran pengguna (RBAC)"
              >
                <option value="SUPERADMIN">Superadmin</option>
                <option value="KA_SPPG">Ka SPPG</option>
                <option value="ADMIN">Admin</option>
                <option value="ASLAP">Aslap</option>
                <option value="AKUNTAN">Akuntan</option>
              </select>
            </div>

            {/* Reset Button */}
            <button
              onClick={onResetData}
              title="Reset data demo ke kondisi default"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Logout Button */}
            <button
              onClick={logout}
              title="Keluar dari sistem"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="border-t border-slate-100 bg-slate-50/70 overflow-x-visible">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between py-1">
          <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none py-0.5">
            {primaryNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-emerald-800 shadow-2xs border border-slate-200 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Dropdown for Secondary / Legacy Modules */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  isSecondaryActive
                    ? 'bg-white text-emerald-800 shadow-2xs border border-slate-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Modul Lainnya</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMoreOpen ? 'rotate-180 text-emerald-700' : 'text-slate-400'}`} />
              </button>

              {isMoreOpen && (
                <div className="absolute left-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 py-1 text-[10px] font-semibold text-slate-400">
                    Operasional & Inventaris
                  </div>
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
                        className={`w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-800 font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
