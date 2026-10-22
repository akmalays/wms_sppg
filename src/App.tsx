import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { DailyExpensesModule } from './components/DailyExpensesModule';
import { InventoryModule } from './components/InventoryModule';
import { NonFoodExpensesModule } from './components/NonFoodExpensesModule';
import { MenuOrdersModule } from './components/MenuOrdersModule';
import { WasteLogModule } from './components/WasteLogModule';
import { ToolsPrintModule, PrintTarget } from './components/ToolsPrintModule';
import { ProfileModule } from './components/ProfileModule';
import { EmployeeAttendanceModule } from './components/EmployeeAttendanceModule';
import { ReceivingModule } from './components/ReceivingModule';
import { DailyFlowModule } from './components/DailyFlowModule';
import { StockMovementModule } from './components/StockMovementModule';
import { StockOpnameModule } from './components/StockOpnameModule';
import { EquipmentModule } from './components/EquipmentModule';
import { SuppliersModule } from './components/SuppliersModule';
import { AuditLogModule } from './components/AuditLogModule';
import { MenuPrintModule } from './components/MenuPrintModule';
import { LoginPage } from './components/LoginPage';
import { LandingPage } from './components/LandingPage';
import { WebsiteCmsModule } from './components/WebsiteCmsModule';
import { DailyMenuPublicPage } from './components/DailyMenuPublicPage';
import { ScanResultModule } from './components/ScanResultModule';
import { QrScannerDialog } from './components/common/QrScannerDialog';
import { SCAN_PATH, ScanTarget, scanTargetFromLocation, isWasteEntryTarget } from './utils/scanCode';

export type AppRouteType = 'DASHBOARD' | 'MENU_TODAY' | 'LANDING';

export const getAppRoute = (): AppRouteType => {
  if (typeof window === 'undefined') return 'LANDING';
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  const hash = window.location.hash.toLowerCase().replace(/\/+$/, '');

  if (
    path === '/menu-mbg-hari-ini' ||
    path.startsWith('/menu-mbg-hari-ini/') ||
    hash === '#/menu-mbg-hari-ini' ||
    hash.startsWith('#/menu-mbg-hari-ini/') ||
    hash === '#menu-mbg-hari-ini'
  ) {
    return 'MENU_TODAY';
  }

  if (
    // Tautan QR label (/s/<kode>) membuka hasil pindai di dashboard; belum login berarti login dulu.
    path.startsWith(SCAN_PATH) ||
    path === '/dashboard' ||
    path.startsWith('/dashboard/') ||
    path === '/login' ||
    path.startsWith('/login/') ||
    hash === '#/dashboard' ||
    hash.startsWith('#/dashboard/') ||
    hash === '#dashboard' ||
    hash === '#/login' ||
    hash.startsWith('#/login/') ||
    hash === '#login'
  ) {
    return 'DASHBOARD';
  }

  return 'LANDING';
};

const MainLayout: React.FC = () => {
  const { currentUser, isAuthenticated } = useAuth();
  // Dibaca sekali saat aplikasi dibuka dari tautan QR, dan tetap tersimpan selama proses login.
  const [scanTarget, setScanTarget] = useState<ScanTarget | null>(() => {
    const t = scanTargetFromLocation();
    return isWasteEntryTarget(t) ? null : t;
  });
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(() => {
    const t = scanTargetFromLocation();
    return isWasteEntryTarget(t) ? 'waste_logs' : t ? 'scan' : 'dashboard';
  });
  // Naik setiap kali QR Form Rekapitulasi Limbah dipindai; Rekap Limbah lalu membuka isian sisa makanan.
  const [wasteEntryRequest, setWasteEntryRequest] = useState(() => (isWasteEntryTarget(scanTargetFromLocation()) ? 1 : 0));
  const [currentRoute, setCurrentRoute] = useState<AppRouteType>(getAppRoute);
  const [dataVersion, setDataVersion] = useState<number>(0);
  // Form yang dibuka saat pindah ke Cetak Form dari halaman lain (nota supplier, label aset).
  const [printTarget, setPrintTarget] = useState<PrintTarget | undefined>(undefined);

  // Target cetak hanya berlaku sekali; dibersihkan begitu pengguna meninggalkan Cetak Form.
  // Begitu juga permintaan isian limbah dari QR, supaya tidak terbuka lagi saat kembali ke Rekap Limbah.
  React.useEffect(() => {
    if (activeTab !== 'tools_forms') setPrintTarget(undefined);
    if (activeTab !== 'waste_logs') setWasteEntryRequest(0);
  }, [activeTab]);

  // Sync state when browser URL changes (back/forward navigation or hash change)
  React.useEffect(() => {
    const handleLocationChange = () => {
      setCurrentRoute(getAppRoute());
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Listen for realtime cloud synchronization and storage mutations
  React.useEffect(() => {
    const handleSync = () => {
      setDataVersion(v => v + 1);
    };
    window.addEventListener('sppg_storage_items_changed', handleSync);
    window.addEventListener('sppg_warehouse_sync', handleSync);
    return () => {
      window.removeEventListener('sppg_storage_items_changed', handleSync);
      window.removeEventListener('sppg_warehouse_sync', handleSync);
    };
  }, []);

  const navigateToDashboard = () => {
    try {
      window.history.pushState(null, '', '/dashboard');
    } catch {
      window.location.hash = '/dashboard';
    }
    setCurrentRoute('DASHBOARD');
  };

  const navigateToHome = () => {
    try {
      window.history.pushState(null, '', '/');
    } catch {
      window.location.hash = '';
    }
    setCurrentRoute('LANDING');
  };

  const navigateToMenuToday = () => {
    try {
      window.history.pushState(null, '', '/menu-mbg-hari-ini');
    } catch {
      window.location.hash = '/menu-mbg-hari-ini';
    }
    setCurrentRoute('MENU_TODAY');
  };

  // Alamat /s/... dibersihkan saat pindah menu, agar muat ulang halaman tidak membuka hasil pindai lagi.
  // Untuk QR limbah dibersihkan juga, supaya isian tidak terbuka lagi saat dimuat ulang.
  React.useEffect(() => {
    if (activeTab !== 'scan' && window.location.pathname.startsWith(SCAN_PATH)) {
      window.history.replaceState(null, '', '/dashboard');
    }
  }, [activeTab]);

  const openScanResult = React.useCallback((target: ScanTarget) => {
    setIsScannerOpen(false);
    if (isWasteEntryTarget(target)) {
      setWasteEntryRequest(n => n + 1);
      setActiveTab('waste_logs');
      return;
    }
    setScanTarget(target);
    setActiveTab('scan');
  }, []);

  const openPrintForm = (target: PrintTarget) => {
    setPrintTarget(target);
    setActiveTab('tools_forms');
  };

  // 1. Rute Khusus Akses QR Code Publik: /menu-mbg-hari-ini
  if (currentRoute === 'MENU_TODAY') {
    return <DailyMenuPublicPage />;
  }

  // 2. Rute Beranda Umum (Landing Page Utama)
  if (currentRoute === 'LANDING') {
    return (
      <LandingPage
        isStaffLoggedIn={isAuthenticated}
        staffName={currentUser?.name}
        onReturnToDashboard={isAuthenticated ? navigateToDashboard : undefined}
      />
    );
  }

  // 2. Jika mengakses rute /dashboard tetapi belum login: Tampilkan form login petugas
  if (!isAuthenticated) {
    // Pendaftaran mandiri ditutup: siapa pun bisa membuat akun Superadmin lewat halaman itu.
    // Akun dibuat Superadmin / Kepala SPPG di menu Karyawan > Akun aplikasi.
    return <LoginPage onNavigateToLanding={navigateToHome} />;
  }

  const handleRefresh = () => {
    setDataVersion(v => v + 1);
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col text-slate-800 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Navigation & Header */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onViewLanding={navigateToHome}
        onOpenScanner={() => setIsScannerOpen(true)}
      />
      {isScannerOpen && (
        <QrScannerDialog hint="Arahkan ke QR pada label barang, plakat rak, tag, atau aset." onResult={openScanResult} onClose={() => setIsScannerOpen(false)} />
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Remounting on every data change resets open forms, tabs and post-save dialogs.
            These modules listen to the same sync events and reload their own data, so they are exempt. */}
        <div key={SELF_SYNCING_TABS.has(activeTab) ? activeTab : dataVersion}>
          {/* Primary Focused Modules */}
          {activeTab === 'dashboard' && (
            <DashboardView
              onNavigate={setActiveTab}
              onRefreshData={handleRefresh}
              onPrintReceiving={receivingId => openPrintForm({ form: 'RECEIVING_FORM', receivingId })}
            />
          )}

          {activeTab === 'daily_expenses' && (
            <DailyExpensesModule onNavigate={setActiveTab} />
          )}

          {activeTab === 'inventory' && (
            <InventoryModule onRefreshData={handleRefresh} initialTab="stock" />
          )}

          {activeTab === 'nonfood_expenses' && (
            <NonFoodExpensesModule />
          )}

          {(activeTab === 'menu_orders' || activeTab === 'menu_portions') && (
            <MenuOrdersModule
              onNavigate={setActiveTab}
              initialView={activeTab === 'menu_portions' ? 'PORSI_HARI_INI' : undefined}
            />
          )}

          {activeTab === 'waste_logs' && (
            <WasteLogModule entryRequest={wasteEntryRequest} />
          )}

          {/* Kelola Pengguna digabung ke halaman Karyawan sebagai tab "Akun aplikasi". */}
          {(activeTab === 'employees' || activeTab === 'user_management') && (
            <EmployeeAttendanceModule
              key={activeTab}
              initialTab={activeTab === 'user_management' ? 'ACCOUNTS' : undefined}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileModule onNavigate={setActiveTab} />
          )}

          {activeTab === 'tools_forms' && (
            <ToolsPrintModule
              initialForm={printTarget?.form}
              initialSupplierId={printTarget?.supplierId}
              initialLabelSearch={printTarget?.labelSearch}
              initialReceivingId={printTarget?.receivingId}
            />
          )}

          {/* Secondary / Deep Logistics Modules */}
          {activeTab === 'receiving' && (
            <ReceivingModule
              onRefreshData={handleRefresh}
              onNavigate={setActiveTab}
              onPrintReceiving={receivingId => openPrintForm({ form: 'RECEIVING_FORM', receivingId })}
            />
          )}

          {activeTab === 'daily_flow' && (
            <DailyFlowModule />
          )}

          {activeTab === 'ledger' && <StockMovementModule />}

          {activeTab === 'stock_opname' && (
            <InventoryModule onRefreshData={handleRefresh} initialTab="opname" />
          )}

          {activeTab === 'equipment' && (
            <EquipmentModule onPrintLabel={assetId => openPrintForm({ form: 'EQUIPMENT_LABEL', labelSearch: assetId })} />
          )}

          {activeTab === 'suppliers' && (
            <SuppliersModule
              onNavigateToExpense={supplierId => openPrintForm({ form: 'SUPPLIER_EXPENSE_NOTE', supplierId })}
            />
          )}

          {activeTab === 'menu_print' && (
            <MenuPrintModule onNavigate={setActiveTab} />
          )}


          {activeTab === 'website_cms' && (
            <WebsiteCmsModule />
          )}

          {activeTab === 'audit' && <AuditLogModule />}
          {activeTab === 'scan' && <ScanResultModule target={scanTarget} onTargetChange={openScanResult} onNavigate={setActiveTab} />}
        </div>
      </main>

      {/* Operational Footer - Technical Logistics Style */}
      <footer className="border-t border-slate-200 bg-white py-3.5 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-slate-600">
          <span className="font-semibold text-slate-800">SPPG Tumpang Jeru · Gudang & Logistik</span>
          <span>Program Makan Bergizi Gratis, Badan Gizi Nasional</span>
        </div>
      </footer>
    </div>
  );
};

const SELF_SYNCING_TABS = new Set(['profile', 'menu_print', 'receiving', 'inventory', 'stock_opname', 'daily_expenses', 'waste_logs', 'daily_flow', 'equipment', 'suppliers', 'employees', 'user_management', 'audit', 'scan']);

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <MainLayout />
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
