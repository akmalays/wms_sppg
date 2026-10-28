import {StrictMode, lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';

// Halaman absen karyawan (/absen, dari QR di lobby) dimuat terpisah: aplikasi utama memuat seluruh
// data gudang saat dibuka, dan itu tidak boleh terjadi di HP karyawan setiap kali absen.
// Panduan area (/panduan/<area>, dari QR papan nama rak) juga terpisah dan tanpa login.
const isAttendancePage = /^\/absen\/?$/i.test(window.location.pathname);
const isAreaGuidePage = /^\/panduan(\/|$)/i.test(window.location.pathname);
// Uji hedonik (/nilai/<kode>, dari QR di surat jalan) diisi guru/PIC sekolah tanpa login.
const isHedonicPage = /^\/nilai\//i.test(window.location.pathname);

const App = lazy(() => import('./App.tsx'));
const AttendanceSelfCheckIn = lazy(() => import('./components/AttendanceSelfCheckIn'));
const AreaGuidePage = lazy(() => import('./components/AreaGuidePage'));
const HedonicFormPage = lazy(() => import('./components/HedonicFormPage'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {isAttendancePage ? <AttendanceSelfCheckIn /> : isAreaGuidePage ? <AreaGuidePage /> : isHedonicPage ? <HedonicFormPage /> : <App />}
    </Suspense>
  </StrictMode>,
);
