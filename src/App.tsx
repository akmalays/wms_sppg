import React, { useState } from 'react';
import { Monitor } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
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
import { DocumentSignersModule } from './components/DocumentSignersModule';
import { MenuPrintModule } from './components/MenuPrintModule';
import { ManualNotaModule } from './components/print/ManualNotaPesananDoc';
import { LoginPage } from './components/LoginPage';
import { LandingPage } from './components/LandingPage';
import { WebsiteCmsModule } from './components/WebsiteCmsModule';
import { DailyMenuPublicPage } from './components/DailyMenuPublicPage';
import { AiAssistantModule } from './components/ai/AiAssistantModule';
import { HedonicRecapModule } from './components/HedonicRecapModule';
import { ScanResultModule } from './components/ScanResultModule';
import { QrScannerDialog } from './components/common/QrScannerDialog';
import { SCAN_PATH, ScanTarget, scanTargetFromLocation, isWasteEntryTarget, isNonFoodIssueTarget, poIdFromScanTarget } from './utils/scanCode';
import { enablePwa, PWA_UPDATED_EVENT } from './utils/pwa';

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
  const toast = useToast();
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  );

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const printMq = window.matchMedia('print');
    let isPrinting = printMq.matches;
    let settleTimer: number | undefined;

    const isInPrintMode = () => isPrinting || printMq.matches;
    const syncDesktopAfterPrint = () => {
      if (settleTimer !== undefined) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        isPrinting = printMq.matches;
        if (!isInPrintMode()) setIsDesktop(mq.matches);
      }, 150);
    };

    const onChange = (e: MediaQueryListEvent) => {
      // Saat dialog cetak terbuka, lebar kertas A4 portrait (< 1024px) membuat (min-width: 1024px) menjadi false.
      // Abaikan saat mode cetak aktif agar Cetak Form tidak di-unmount dan reset ke form awal setelah cetak.
      if (isInPrintMode()) return;
      setIsDesktop(e.matches);
    };
    const onBeforePrint = () => {
      if (settleTimer !== undefined) window.clearTimeout(settleTimer);
      isPrinting = true;
    };
    const onAfterPrint = () => {
      syncDesktopAfterPrint();
    };
    const onPrintMqChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        if (settleTimer !== undefined) window.clearTimeout(settleTimer);
        isPrinting = true;
      } else {
        syncDesktopAfterPrint();
      }
    };

    if (!isInPrintMode()) setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    printMq.addEventListener('change', onPrintMqChange);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      if (settleTimer !== undefined) window.clearTimeout(settleTimer);
      mq.removeEventListener('change', onChange);
      printMq.removeEventListener('change', onPrintMqChange);
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, []);
  // Dibaca sekali saat aplikasi dibuka dari tautan QR, dan tetap tersimpan selama proses login.
  const [scanTarget, setScanTarget] = useState<ScanTarget | null>(() => {
    const t = scanTargetFromLocation();
    return isWasteEntryTarget(t) || isNonFoodIssueTarget(t) || poIdFromScanTarget(t) ? null : t;
  });
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(() => {
    const t = scanTargetFromLocation();
    if (isWasteEntryTarget(t)) return 'waste_logs';
    if (isNonFoodIssueTarget(t)) return 'daily_flow';
    if (poIdFromScanTarget(t)) return 'receiving';
    return t ? 'scan' : 'dashboard';
  });
  // Naik setiap kali QR Form Rekapitulasi Limbah dipindai; Rekap Limbah lalu membuka isian sisa makanan.
  const [wasteEntryRequest, setWasteEntryRequest] = useState(() => (isWasteEntryTarget(scanTargetFromLocation()) ? 1 : 0));
  // Naik setiap kali QR Form Pengambilan Non-Food dipindai; Barang Keluar > Operasional lalu membuka dialog form kertas.
  const [nonFoodIssueRequest, setNonFoodIssueRequest] = useState(() => (isNonFoodIssueTarget(scanTargetFromLocation()) ? 1 : 0));
  // PO dari QR Form PO & Penerimaan Bahan; Barang Masuk membuka timbangnya lalu mengosongkan ini.
  const [poReceiveRequest, setPoReceiveRequest] = useState<string | null>(() => poIdFromScanTarget(scanTargetFromLocation()));
  // Dari Laporan Pengeluaran: Barang Masuk langsung membuka form Belanja Non-Menu.
  const [nonMenuFormRequest, setNonMenuFormRequest] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<AppRouteType>(getAppRoute);
  const [dataVersion, setDataVersion] = useState<number>(0);
  // Form yang dibuka saat pindah ke Cetak Form dari halaman lain (nota supplier, label aset).
  const [printTarget, setPrintTarget] = useState<PrintTarget | undefined>(undefined);

  // Target cetak hanya berlaku sekali; dibersihkan begitu pengguna meninggalkan Cetak Form.
  // Begitu juga permintaan isian limbah / form kertas non-food dari QR, supaya tidak terbuka lagi saat kembali.
  React.useEffect(() => {
    if (activeTab !== 'tools_forms') setPrintTarget(undefined);
    if (activeTab !== 'waste_logs') setWasteEntryRequest(0);
    if (activeTab !== 'daily_flow') setNonFoodIssueRequest(0);
    if (activeTab !== 'receiving') {
      setPoReceiveRequest(null);
      setNonMenuFormRequest(false);
    }
  }, [activeTab]);

  React.useEffect(() => {
    if (currentRoute === 'DASHBOARD') enablePwa();
  }, [currentRoute]);

  const [isUpdateReady, setIsUpdateReady] = useState(false);
  React.useEffect(() => {
    const onUpdated = () => setIsUpdateReady(true);
    window.addEventListener(PWA_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(PWA_UPDATED_EVENT, onUpdated);
  }, []);

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
    if (isNonFoodIssueTarget(target)) {
      setNonFoodIssueRequest(n => n + 1);
      setActiveTab('daily_flow');
      return;
    }
    const poId = poIdFromScanTarget(target);
    if (poId) {
      setPoReceiveRequest(poId);
      setActiveTab('receiving');
      return;
    }
    setScanTarget(target);
    setActiveTab('scan');
  }, []);

  const openPrintForm = (target: PrintTarget) => {
    if (!isDesktop) {
      toast.warning('Halaman Cetak Form hanya bisa diakses di tampilan desktop atau laptop.', 'Cetak Form');
      return;
    }
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

      {isUpdateReady && (
        <div
          role="status"
          className="print:hidden fixed inset-x-3 bottom-[calc(4.75rem_+_var(--safe-bottom))] lg:bottom-4 lg:left-auto lg:right-4 lg:w-96 z-40 flex items-center justify-between gap-3 pl-4 pr-2 py-2 rounded-xl bg-slate-900 text-white text-xs shadow-lg"
        >
          <span>Versi baru aplikasi sudah siap.</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="shrink-0 px-3 min-h-[44px] rounded-lg bg-white text-slate-900 font-semibold cursor-pointer hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Muat ulang
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {/* Di bawah lg, ruang bawah disisakan untuk bilah navigasi yang menempel di dasar layar */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-[calc(5.5rem_+_var(--safe-bottom))] lg:pb-6 print:pb-0">
        {/* Remounting on every data change resets open forms, tabs and post-save dialogs.
            These modules listen to the same sync events and reload their own data, so they are exempt. */}
        <div key={getTabWrapperKey(activeTab, dataVersion)}>
          {/* Primary Focused Modules */}
          {activeTab === 'dashboard' && (
            <DashboardView
              onNavigate={setActiveTab}
              onRefreshData={handleRefresh}
              onPrintReceiving={isDesktop ? (receivingId => openPrintForm({ form: 'RECEIVING_FORM', receivingId })) : undefined}
            />
          )}

          {activeTab === 'daily_expenses' && (
            <DailyExpensesModule
              onNavigate={setActiveTab}
              onOpenNonMenuPurchase={() => {
                setNonMenuFormRequest(true);
                setActiveTab('receiving');
              }}
              onOpenNonFoodIssue={() => {
                setNonFoodIssueRequest(n => n + 1);
                setActiveTab('daily_flow');
              }}
            />
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
              onPrintPoSheet={isDesktop ? (date => openPrintForm({ form: 'DAILY_PO_SHEET', date })) : undefined}
              initialView={activeTab === 'menu_portions' ? 'PORSI_HARI_INI' : undefined}
            />
          )}

          {activeTab === 'waste_logs' && (
            <WasteLogModule entryRequest={wasteEntryRequest} />
          )}

          {activeTab === 'hedonic_recap' && <HedonicRecapModule />}
          {activeTab === 'manual_nota' && <ManualNotaModule />}
          {activeTab === 'ai_assistant' && <AiAssistantModule />}

          {/* Kelola Pengguna digabung ke halaman Karyawan sebagai tab "Akun aplikasi". */}
          {(activeTab === 'employees' || activeTab === 'user_management') && (
            <EmployeeAttendanceModule
              key={activeTab}
              initialTab={activeTab === 'user_management' ? 'ACCOUNTS' : undefined}
            />
          )}

          {activeTab === 'document_signers' && <DocumentSignersModule />}

          {activeTab === 'profile' && (
            <ProfileModule onNavigate={setActiveTab} />
          )}

          {activeTab === 'tools_forms' && (
            isDesktop ? (
              <ToolsPrintModule
                initialForm={printTarget?.form}
                initialSupplierId={printTarget?.supplierId}
                initialLabelSearch={printTarget?.labelSearch}
                initialReceivingId={printTarget?.receivingId}
                initialDate={printTarget?.date}
              />
            ) : (
              <div className="max-w-md mx-auto my-6 bg-white rounded-xl border border-slate-200 p-6 text-center space-y-3">
                <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 mx-auto flex items-center justify-center">
                  <Monitor className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-slate-900">Cetak Form hanya untuk desktop</h1>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Halaman Cetak Form disiapkan untuk pratinjau dan cetak dokumen A4/F4. Buka aplikasi di komputer atau laptop untuk mengaksesnya.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="inline-flex items-center justify-center px-4 min-h-[44px] rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
                >
                  Kembali ke Ringkasan
                </button>
              </div>
            )
          )}

          {/* Secondary / Deep Logistics Modules */}
          {activeTab === 'receiving' && (
            <ReceivingModule
              onRefreshData={handleRefresh}
              onNavigate={setActiveTab}
              onPrintReceiving={isDesktop ? (receivingId => openPrintForm({ form: 'RECEIVING_FORM', receivingId })) : undefined}
              openPoWeighingId={poReceiveRequest}
              onPoWeighingOpened={() => setPoReceiveRequest(null)}
              openNonMenuForm={nonMenuFormRequest}
              onNonMenuFormOpened={() => setNonMenuFormRequest(false)}
            />
          )}

          {activeTab === 'daily_flow' && (
            <DailyFlowModule openPaperFormRequest={nonFoodIssueRequest} />
          )}

          {activeTab === 'ledger' && <StockMovementModule />}

          {activeTab === 'stock_opname' && (
            <InventoryModule onRefreshData={handleRefresh} initialTab="opname" />
          )}

          {activeTab === 'equipment' && (
            <EquipmentModule onPrintLabel={isDesktop ? (assetId => openPrintForm({ form: 'EQUIPMENT_LABEL', labelSearch: assetId })) : undefined} />
          )}

          {activeTab === 'suppliers' && (
            <SuppliersModule
              onNavigateToExpense={isDesktop ? (supplierId => openPrintForm({ form: 'SUPPLIER_EXPENSE_NOTE', supplierId })) : undefined}
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
      <footer className="hidden lg:block border-t border-slate-200 bg-white py-3.5 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-slate-600">
          <span className="font-semibold text-slate-800">SPPG Tumpang Jeru · Gudang & Logistik</span>
          <span>Program Makan Bergizi Gratis, Badan Gizi Nasional</span>
        </div>
      </footer>
    </div>
  );
};

const SELF_SYNCING_TABS = new Set(['profile', 'menu_orders', 'menu_portions', 'menu_print', 'manual_nota', 'tools_forms', 'receiving', 'inventory', 'stock_opname', 'daily_expenses', 'waste_logs', 'hedonic_recap', 'ai_assistant', 'daily_flow', 'equipment', 'suppliers', 'employees', 'user_management', 'audit', 'scan', 'document_signers']);

// Tab yang menampilkan modul yang sama memakai key yang sama agar perpindahan alias (mis. menu_portions → menu_orders) tidak me-remount modul.
const getTabWrapperKey = (tab: string, version: number): string | number => {
  if (!SELF_SYNCING_TABS.has(tab)) return version;
  if (tab === 'menu_portions') return 'menu_orders';
  return tab;
};

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
