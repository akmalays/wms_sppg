import React, { useState, useEffect } from 'react';
import { useAuth, PermissionAction } from '../context/AuthContext';
import { UserRole } from '../types/warehouse';
import { SppgLogo } from './SppgLogo';
import {
  ChevronDown,
  CheckCircle2,
  Globe,
  LogOut,
  Menu,
  UserCheck,
  X,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onViewLanding?: () => void;
}

// Role switching and database reset are demo tools: any user could promote themselves or wipe stock.
// They only render in local development or when VITE_DEMO_MODE="true".
const DEMO_TOOLS_ENABLED = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true';

const ROLE_OPTIONS: { role: UserRole; label: string; shortLabel: string }[] = [
  { role: 'SUPERADMIN', label: 'Superadmin', shortLabel: 'Superadmin' },
  { role: 'KA_SPPG', label: 'Kepala SPPG', shortLabel: 'Ka SPPG' },
  { role: 'ADMIN', label: 'Admin Gudang', shortLabel: 'Admin' },
  { role: 'ASLAP', label: 'Asisten Lapangan', shortLabel: 'Aslap' },
  { role: 'AKUNTAN', label: 'Akuntan & Kasir', shortLabel: 'Akuntan' },
];

interface NavItem {
  id: string;
  label: string;
  // Menu disembunyikan bagi peran tanpa izin ini.
  permission?: PermissionAction;
}

// Daily work stays one click away; reports and admin modules sit in two dropdowns.
const DAILY_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Ringkasan' },
  { id: 'receiving', label: 'Barang Datang' },
  { id: 'menu_orders', label: 'Menu' },
  { id: 'inventory', label: 'Stok' },
  { id: 'daily_flow', label: 'Pemakaian Dapur' },
];

const NAV_GROUPS: { id: 'laporan' | 'lainnya'; label: string; items: NavItem[] }[] = [
  {
    id: 'laporan',
    label: 'Laporan',
    items: [
      { id: 'daily_expenses', label: 'Pengeluaran' },
      { id: 'waste_logs', label: 'Rekap Limbah' },
      { id: 'tools_forms', label: 'Cetak Form' },
    ],
  },
  {
    id: 'lainnya',
    label: 'Lainnya',
    items: [
      { id: 'employees', label: 'Karyawan' },
      { id: 'equipment', label: 'Aset Dapur' },
      { id: 'suppliers', label: 'Supplier' },
      { id: 'website_cms', label: 'Atur Website' },
      { id: 'audit', label: 'Riwayat Aktivitas', permission: 'VIEW_AUDIT' },
    ],
  },
];

type OpenMenu = 'laporan' | 'lainnya' | 'user' | null;

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1';
const MENU_PANEL = 'absolute mt-2 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50';
const MENU_ITEM = `w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-xs cursor-pointer min-h-[40px] transition-colors ${FOCUS}`;

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab, onViewLanding }) => {
  const { currentUser, switchUser, logout, can } = useAuth();
  const allowed = (item: NavItem) => !item.permission || can(item.permission);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close menus on outside click or Escape. Each menu wraps itself in [data-menu].
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as Element).closest('[data-menu]')) setOpenMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null);
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Date only; a ticking clock adds motion without helping any task. Refresh each minute for midnight rollover.
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const dateLabel = now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  const roleInfo = ROLE_OPTIONS.find(r => r.role === currentUser.role);

  const go = (tab: string) => {
    onSelectTab(tab);
    setOpenMenu(null);
    setIsMobileMenuOpen(false);
  };

  const toggle = (menu: OpenMenu) => setOpenMenu(prev => (prev === menu ? null : menu));

  const navButtonClass = (isActive: boolean) =>
    `inline-flex items-center gap-1 px-3 py-2 text-xs rounded-lg whitespace-nowrap transition-colors cursor-pointer ${FOCUS} ${
      isActive ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-medium'
    }`;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-4">
        {/* Identity */}
        <button
          type="button"
          onClick={() => go('dashboard')}
          className={`flex items-center gap-2.5 min-w-0 shrink-0 rounded-lg cursor-pointer ${FOCUS}`}
          aria-label="SPPG Tumpang Jeru, ke Ringkasan"
        >
          <SppgLogo size="sm" showText={false} />
          <span className="text-left leading-tight">
            <span className="block text-sm font-bold text-slate-900 tracking-tight">SPPG Tumpang Jeru</span>
            <span className="hidden sm:block text-[11px] text-slate-600">Gudang & Logistik</span>
          </span>
        </button>

        {/* Desktop navigation */}
        <nav aria-label="Navigasi utama" className="hidden lg:flex items-center gap-0.5 flex-1 min-w-0">
          {DAILY_ITEMS.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.id)}
              aria-current={activeTab === item.id ? 'page' : undefined}
              className={navButtonClass(activeTab === item.id)}
            >
              {item.label}
            </button>
          ))}

          {NAV_GROUPS.map(group => {
            const activeChild = group.items.find(i => i.id === activeTab);
            const isOpen = openMenu === group.id;
            return (
              <div key={group.id} className="relative" data-menu>
                <button
                  type="button"
                  onClick={() => toggle(group.id)}
                  aria-expanded={isOpen}
                  aria-haspopup="menu"
                  className={navButtonClass(!!activeChild)}
                >
                  {activeChild ? `${group.label}: ${activeChild.label}` : group.label}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div role="menu" className={`${MENU_PANEL} left-0 w-56`}>
                    {group.items.filter(allowed).map(item => (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        onClick={() => go(item.id)}
                        className={`${MENU_ITEM} ${
                          activeTab === item.id ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <span className="hidden xl:block text-xs text-slate-600 tabular-nums">{dateLabel}</span>

          <div className="relative" data-menu>
            <button
              type="button"
              onClick={() => toggle('user')}
              aria-expanded={openMenu === 'user'}
              aria-haspopup="menu"
              aria-label={`Menu akun ${currentUser.name}`}
              className={`flex items-center gap-2 p-1 pr-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer min-h-[44px] lg:min-h-[40px] ${FOCUS} ${
                openMenu === 'user' ? 'bg-slate-50' : 'bg-white'
              }`}
            >
              <span className="w-8 h-8 rounded-md bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser.name.charAt(0)}
              </span>
              <span className="hidden md:block text-left leading-tight">
                <span className="block text-xs font-semibold text-slate-900 truncate max-w-[120px]">{currentUser.name}</span>
                <span className="block text-[11px] text-slate-600">{roleInfo?.shortLabel || currentUser.role}</span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            </button>

            {openMenu === 'user' && (
              <div role="menu" className={`${MENU_PANEL} right-0 w-72 max-h-[calc(100vh-5rem)] overflow-y-auto`}>
                <div className="px-3.5 py-2.5 border-b border-slate-100">
                  <div className="text-sm font-semibold text-slate-900 truncate">{currentUser.name}</div>
                  {currentUser.email && <div className="text-[11px] text-slate-600 truncate">{currentUser.email}</div>}
                  <div className="text-[11px] text-slate-600 mt-0.5">{roleInfo?.label || currentUser.role}</div>
                </div>

                <div className="py-1">
                  <button type="button" role="menuitem" onClick={() => go('profile')} className={`${MENU_ITEM} text-slate-700 hover:bg-slate-50`}>
                    <UserCheck className="w-4 h-4 text-slate-500" />
                    Profil & Checklist Tugas
                  </button>
                  {onViewLanding && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpenMenu(null);
                        onViewLanding();
                      }}
                      className={`${MENU_ITEM} text-slate-700 hover:bg-slate-50`}
                    >
                      <Globe className="w-4 h-4 text-slate-500" />
                      Lihat Website Publik
                    </button>
                  )}
                </div>

                {DEMO_TOOLS_ENABLED && (
                  <div className="py-1 border-t border-slate-100">
                    <div className="px-3.5 pt-1.5 pb-1 text-[11px] font-semibold text-slate-600">Mode demo: ganti peran</div>
                    {ROLE_OPTIONS.map(opt => {
                      const isSelected = opt.role === currentUser.role;
                      return (
                        <button
                          key={opt.role}
                          type="button"
                          role="menuitemradio"
                          aria-checked={isSelected}
                          onClick={() => {
                            switchUser(opt.role);
                            setOpenMenu(null);
                          }}
                          className={`${MENU_ITEM} justify-between ${
                            isSelected ? 'text-emerald-800 font-semibold bg-emerald-50' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {opt.label}
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="pt-1 border-t border-slate-100">
                  <button type="button" role="menuitem" onClick={logout} className={`${MENU_ITEM} text-slate-700 hover:bg-slate-50`}>
                    <LogOut className="w-4 h-4 text-slate-500" />
                    Keluar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile & tablet navigation toggle */}
          <button
            type="button"
            onClick={() => {
              setOpenMenu(null);
              setIsMobileMenuOpen(open => !open);
            }}
            className={`lg:hidden p-2 rounded-lg text-slate-800 hover:bg-slate-100 border border-slate-200 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center ${FOCUS}`}
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile & tablet navigation drawer */}
      {isMobileMenuOpen && (
        <nav
          aria-label="Navigasi utama"
          className="lg:hidden border-t border-slate-200 bg-white max-h-[calc(100vh-3.5rem)] overflow-y-auto"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-3">
            <p className="text-[11px] text-slate-600 sm:hidden">{dateLabel}</p>
            {[{ id: 'harian', label: 'Harian', items: DAILY_ITEMS }, ...NAV_GROUPS].map(group => (
              <div key={group.id}>
                <div className="text-[11px] font-semibold text-slate-600 mb-1 px-1">{group.label}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {group.items.filter(allowed).map(item => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => go(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm cursor-pointer min-h-[44px] transition-colors ${FOCUS} ${
                          isActive ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
};
