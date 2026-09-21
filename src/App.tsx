import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { ReceivingModule } from './components/ReceivingModule';
import { DailyFlowModule } from './components/DailyFlowModule';
import { InventoryModule } from './components/InventoryModule';
import { StockMovementModule } from './components/StockMovementModule';
import { StockOpnameModule } from './components/StockOpnameModule';
import { EquipmentModule } from './components/EquipmentModule';
import { SuppliersModule } from './components/SuppliersModule';
import { AuditLogModule } from './components/AuditLogModule';
import { ToolsPrintModule } from './components/ToolsPrintModule';
import { warehouseDb } from './db/storage';

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [dataVersion, setDataVersion] = useState<number>(0);
  const { currentUser } = useAuth();

  const handleRefresh = () => {
    setDataVersion(v => v + 1);
  };

  const handleResetData = () => {
    const confirmReset = window.confirm(
      'Reset data ke kondisi awal demo SPPG? Semua data penerimaan dan transaksi simulasi akan dikembalikan ke data awal.'
    );
    if (confirmReset) {
      warehouseDb.resetToSeedData();
      setDataVersion(v => v + 1);
      alert('Data gudang SPPG berhasil di-reset ke data bawaan.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800">
      {/* Navigation & Header */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onResetData={handleResetData}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div key={dataVersion}>
          {activeTab === 'dashboard' && (
            <DashboardView
              onNavigate={setActiveTab}
              onRefreshData={handleRefresh}
            />
          )}

          {activeTab === 'receiving' && (
            <ReceivingModule onRefreshData={handleRefresh} />
          )}

          {activeTab === 'daily_flow' && (
            <DailyFlowModule onRefreshData={handleRefresh} />
          )}

          {activeTab === 'inventory' && (
            <InventoryModule onRefreshData={handleRefresh} />
          )}

          {activeTab === 'ledger' && <StockMovementModule />}

          {activeTab === 'stock_opname' && (
            <StockOpnameModule onRefreshData={handleRefresh} />
          )}

          {activeTab === 'equipment' && (
            <EquipmentModule onRefreshData={handleRefresh} />
          )}

          {activeTab === 'suppliers' && (
            <SuppliersModule onRefreshData={handleRefresh} />
          )}

          {activeTab === 'tools_forms' && <ToolsPrintModule />}

          {activeTab === 'audit' && <AuditLogModule />}
        </div>
      </main>

      {/* Operational Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>SPPG Warehouse Management MVP • Siap Operasional Lapangan</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>User Aktif: <strong className="text-slate-700">{currentUser.name}</strong> ({currentUser.role})</span>
            <span>Status Penyimpanan: <strong className="text-emerald-700">Tersimpan Otomatis (Lokal/Browser)</strong></span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
