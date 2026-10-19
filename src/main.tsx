import {StrictMode, lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';

// Halaman absen karyawan (/absen, dari QR di lobby) dimuat terpisah: aplikasi utama memuat seluruh
// data gudang saat dibuka, dan itu tidak boleh terjadi di HP karyawan setiap kali absen.
const isAttendancePage = /^\/absen\/?$/i.test(window.location.pathname);

const App = lazy(() => import('./App.tsx'));
const AttendanceSelfCheckIn = lazy(() => import('./components/AttendanceSelfCheckIn'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{isAttendancePage ? <AttendanceSelfCheckIn /> : <App />}</Suspense>
  </StrictMode>,
);
