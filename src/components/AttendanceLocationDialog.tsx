import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { warehouseDb } from '../db/storage';
import { useAuth } from '../context/AuthContext';
import { AttendanceGeofence, DEFAULT_GEOFENCE_RADIUS, GEOFENCE_SETTING_KEY, isValidGeofence } from '../utils/attendanceAction';
import { FormDialog, FIELD_INPUT, FIELD_LABEL, BTN_SECONDARY } from './common/FormDialog';

// Titik lokasi SPPG dan radius absen. Paling akurat diatur sambil berdiri di lobby (dekat QR absen).

export const AttendanceLocationDialog: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const saved = warehouseDb.getAppSetting<AttendanceGeofence | null>(GEOFENCE_SETTING_KEY, null);
  const [lat, setLat] = useState(saved ? String(saved.lat) : '');
  const [lng, setLng] = useState(saved ? String(saved.lng) : '');
  const [radius, setRadius] = useState(String(saved?.radius ?? DEFAULT_GEOFENCE_RADIUS));
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Perangkat ini tidak mendukung lokasi. Isi koordinat dari Google Maps.');
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setNote(`Akurasi ±${Math.round(pos.coords.accuracy)} m. Bila lebih dari 30 m, coba lagi di dekat pintu atau ruang terbuka.`);
        setLocating(false);
      },
      err => {
        setError(err.code === err.PERMISSION_DENIED ? 'Izin lokasi ditolak. Izinkan lokasi di pengaturan browser.' : 'Lokasi tidak bisa dibaca. Coba lagi.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  // Koordinat bisa ditempel langsung dari Google Maps, mis. "-8.0123, 112.7654"
  const handleLatChange = (value: string) => {
    const pair = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (pair) {
      setLat(pair[1]);
      setLng(pair[2]);
    } else {
      setLat(value);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const geofence = { lat: Number(lat), lng: Number(lng), radius: Math.round(Number(radius)) };
    if (!isValidGeofence(geofence) || Math.abs(geofence.lat) > 90 || Math.abs(geofence.lng) > 180) {
      setError('Koordinat atau radius belum benar.');
      return;
    }
    if (geofence.radius < 20 || geofence.radius > 1000) {
      setError('Radius antara 20 dan 1.000 meter.');
      return;
    }
    warehouseDb.saveAppSetting(GEOFENCE_SETTING_KEY, geofence, currentUser || undefined);
    onSaved();
  };

  const mapsUrl = lat && lng ? `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}` : '';

  return (
    <FormDialog
      title="Lokasi absen"
      description="Karyawan hanya bisa absen dari HP bila berada dalam radius ini dari titik SPPG."
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Simpan lokasi"
      error={error}
    >
      <button type="button" onClick={useCurrentLocation} disabled={locating} className={`${BTN_SECONDARY} w-full`}>
        <MapPin className="w-4 h-4 text-slate-500" />
        {locating ? 'Mencari lokasi…' : 'Pakai lokasi saya sekarang'}
      </button>
      <p className="text-[11px] text-slate-600">Paling tepat dilakukan sambil berdiri di lobby, dekat QR absen ditempel.</p>
      {note && <p className="text-[11px] text-slate-700">{note}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="geo-lat" className={FIELD_LABEL}>Latitude</label>
          <input id="geo-lat" inputMode="decimal" value={lat} onChange={e => handleLatChange(e.target.value)} placeholder="-8.012345" className={`${FIELD_INPUT} font-mono`} />
        </div>
        <div>
          <label htmlFor="geo-lng" className={FIELD_LABEL}>Longitude</label>
          <input id="geo-lng" inputMode="decimal" value={lng} onChange={e => setLng(e.target.value)} placeholder="112.765432" className={`${FIELD_INPUT} font-mono`} />
        </div>
      </div>
      {mapsUrl && (
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-block text-xs font-medium text-emerald-800 underline underline-offset-2">
          Cek titik ini di Google Maps
        </a>
      )}

      <div>
        <label htmlFor="geo-radius" className={FIELD_LABEL}>Radius (meter)</label>
        <input id="geo-radius" type="number" min={20} max={1000} value={radius} onChange={e => setRadius(e.target.value)} className={`${FIELD_INPUT} w-32`} />
        <p className="mt-1 text-[11px] text-slate-600">
          Disarankan 100 m. Terlalu kecil membuat karyawan di dapur bisa tertolak karena GPS dalam gedung kurang akurat.
        </p>
      </div>
    </FormDialog>
  );
};
