import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/warehouse';
import {
  LayoutDashboard,
  Truck,
  Package,
  Layers,
  ClipboardCheck,
  Wrench,
  Building2,
  ShieldAlert,
  RotateCcw,
  Utensils,
  User,
  History,
  Printer
} from 'lucide-react';
import { warehouseDb } from '../db/storage';

interface NavbarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onResetData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab, onResetData }) => {
  const { currentUser, switchUser, can } = useAuth();

  const handleRoleChange = (role: UserRole) => {
    switchUser(role);
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'receiving', label: 'Penerimaan', icon: Truck },
    { id: 'daily_flow', label: 'Aliran Harian', icon: Utensils },
    { id: 'inventory', label: 'Master Stok', icon: Package },
    { id: 'ledger', label: 'Buku Mutasi', icon: History },
    { id: 'stock_opname', label: 'Stock Opname', icon: ClipboardCheck },
    { id: 'equipment', label: 'Peralatan', icon: Wrench },
    { id: 'suppliers', label: 'Supplier', icon: Building2 },
    { id: 'tools_forms', label: 'Cetak Form', icon: Printer },
    { id: 'audit', label: 'Audit Log', icon: ShieldAlert },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-2xs">
      {/* Top Bar: Brand, Info, Role Switcher */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-lg shadow-xs">
              SPPG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                  WMS SPPG
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  MVP v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden md:block">
                Sistem Manajemen Gudang • Satuan Pelayanan Pemenuhan Gizi
              </p>
            </div>
          </div>

          {/* Right Controls: Role Switcher & Reset */}
          <div className="flex items-center gap-3">
            {/* Role Switcher Pill */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 px-3">
              <User className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
              <div className="text-left hidden lg:block">
                <div className="text-[11px] font-medium text-slate-500 leading-none">Simulasi Role</div>
                <div className="text-xs font-bold text-slate-800 leading-tight">{currentUser.name}</div>
              </div>
              <select
                value={currentUser.role}
                onChange={e => handleRoleChange(e.target.value as UserRole)}
                className="text-xs font-bold rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                title="Ganti peran pengguna untuk menguji hak akses RBAC"
              >
                <option value="WAREHOUSE_STAFF">Staff Gudang (Andi Pratama)</option>
                <option value="WAREHOUSE_MANAGER">Warehouse Manager (Budi Santoso)</option>
                <option value="MANAGER">Unit Manager (Dr. Siti Rahma)</option>
                <option value="PURCHASING">Purchasing (Dewi Lestari)</option>
                <option value="QC">Quality Control (Hendra Wijaya)</option>
                <option value="SUPER_ADMIN">Super Admin (System Admin)</option>
              </select>
            </div>

            {/* Reset Button */}
            <button
              onClick={onResetData}
              title="Reset data demo ke kondisi awal"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-bar */}
      <div className="border-t border-slate-100 bg-slate-50/50 overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 sm:space-x-2 py-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-emerald-700 shadow-2xs border border-slate-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
