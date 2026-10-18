import React, { useEffect, useMemo, useState } from 'react';
import { Select } from './common/Select';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { Employee, User, UserRole } from '../types/warehouse';
import { Plus, Search } from 'lucide-react';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_INPUT,
  FIELD_LABEL,
  Feedback,
  FormDialog,
} from './common/FormDialog';

export const ROLE_INFO: Record<UserRole, { label: string; desc: string }> = {
  SUPERADMIN: { label: 'Superadmin', desc: 'Semua fitur, termasuk kelola akun dan riwayat aktivitas.' },
  KA_SPPG: { label: 'Kepala SPPG', desc: 'Semua fitur operasional, setujui opname, kelola akun.' },
  ADMIN: { label: 'Admin Gudang', desc: 'Barang, supplier, barang masuk, stok, dan barang keluar.' },
  ASLAP: { label: 'Asisten Lapangan', desc: 'Barang masuk, opname, aset dapur, barang keluar.' },
  AKUNTAN: { label: 'Akuntan', desc: 'Penerimaan, setujui opname, supplier, dan laporan.' },
};

const ROLES = Object.keys(ROLE_INFO) as UserRole[];
const MIN_PASSWORD = 6;

type DialogState =
  | { mode: 'create' }
  | { mode: 'edit'; user: User }
  | { mode: 'delete'; user: User };

type FormState = {
  name: string;
  email: string;
  role: UserRole;
  employeeId: string;
  nip: string;
  phone: string;
  password: string;
  confirm: string;
};

const emptyForm: FormState = { name: '', email: '', role: 'ASLAP', employeeId: '', nip: '', phone: '', password: '', confirm: '' };

// Akun login aplikasi. Data orangnya (jabatan, HP, NIP) sebaiknya ditautkan ke data karyawan.
export const UserAccountsPanel: React.FC = () => {
  const { currentUser, can } = useAuth();
  const [version, setVersion] = useState(0);
  const users = useMemo(() => warehouseDb.getUsers(), [version]);
  const employees = useMemo(() => warehouseDb.getEmployees(), [version]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const onSync = () => setVersion(v => v + 1);
    window.addEventListener('sppg_storage_items_changed', onSync);
    return () => window.removeEventListener('sppg_storage_items_changed', onSync);
  }, []);

  const employeeById = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const linkedEmployeeIds = useMemo(() => new Set(users.map(u => u.employeeId).filter(Boolean) as string[]), [users]);
  const superadminCount = users.filter(u => u.role === 'SUPERADMIN').length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter(u => roleFilter === 'ALL' || u.role === roleFilter)
      .filter(u => !q || [u.name, u.email, u.nip || ''].some(v => v.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [users, query, roleFilter]);

  if (!can('MANAGE_USERS')) {
    return (
      <p className="py-10 text-center text-xs text-slate-600 bg-white rounded-xl border border-slate-200">
        Akun aplikasi hanya bisa dikelola oleh Superadmin dan Kepala SPPG.
      </p>
    );
  }

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(prev => ({ ...prev, [key]: value }));

  // Memilih karyawan mengisi nama, NIP, dan HP dari data karyawan.
  const pickEmployee = (id: string) => {
    const emp = employeeById.get(id);
    setForm(prev => ({
      ...prev,
      employeeId: id,
      name: emp ? emp.name : prev.name,
      nip: emp ? emp.nip : prev.nip,
      phone: emp ? emp.phone : prev.phone,
    }));
  };

  const openCreate = () => {
    setForm(emptyForm);
    setFormError('');
    setShowPassword(false);
    setDialog({ mode: 'create' });
  };

  const openEdit = (user: User) => {
    // Saran tautan: karyawan bernama sama yang belum punya akun.
    const suggested =
      user.employeeId ||
      employees.find(e => e.name.trim().toLowerCase() === user.name.trim().toLowerCase() && !linkedEmployeeIds.has(e.id))?.id ||
      '';
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      employeeId: suggested,
      nip: user.nip || '',
      phone: user.phone || '',
      password: '',
      confirm: '',
    });
    setFormError('');
    setShowPassword(false);
    setDialog({ mode: 'edit', user });
  };

  const validatePassword = (required: boolean): string | null => {
    if (!form.password && !required) return null;
    if (form.password.length < MIN_PASSWORD) return `Kata sandi minimal ${MIN_PASSWORD} karakter.`;
    if (form.password !== form.confirm) return 'Ulangi kata sandi tidak cocok.';
    return null;
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dialog) return;
    setFormError('');

    if (dialog.mode === 'delete') {
      try {
        warehouseDb.deleteUser(dialog.user.id);
        warehouseDb.logActivity(currentUser, 'USER_DELETED', 'USER', dialog.user.id, `Menghapus akun ${dialog.user.name} (${dialog.user.email}).`);
        setFeedback({ type: 'success', text: `Akun ${dialog.user.name} dihapus.` });
        setDialog(null);
        setVersion(v => v + 1);
      } catch (err: any) {
        setFormError(err?.message || 'Gagal menghapus akun.');
      }
      return;
    }

    const name = form.name.trim();
    if (!name) return setFormError('Nama wajib diisi.');

    try {
      if (dialog.mode === 'create') {
        const email = form.email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setFormError('Email tidak valid.');
        if (users.some(u => u.email.toLowerCase() === email)) return setFormError(`Email ${email} sudah dipakai akun lain.`);
        const pwError = validatePassword(true);
        if (pwError) return setFormError(pwError);
        const created = warehouseDb.registerUser({
          name,
          email,
          role: form.role,
          employeeId: form.employeeId || undefined,
          nip: form.nip.trim() || undefined,
          phone: form.phone.trim() || undefined,
          password: form.password,
        });
        warehouseDb.logActivity(currentUser, 'USER_CREATED', 'USER', created.id, `Membuat akun ${name} (${email}) sebagai ${ROLE_INFO[form.role].label}.`);
        setFeedback({ type: 'success', text: `Akun ${name} dibuat. Ia bisa masuk dengan ${email}.` });
      } else {
        const user = dialog.user;
        if (user.role === 'SUPERADMIN' && form.role !== 'SUPERADMIN' && superadminCount <= 1) {
          return setFormError('Ini satu-satunya Superadmin. Buat Superadmin lain dulu sebelum mengubah perannya.');
        }
        const pwError = validatePassword(false);
        if (pwError) return setFormError(pwError);
        const newRole = user.id === currentUser.id ? user.role : form.role;
        const changes = [
          newRole !== user.role && `peran ${ROLE_INFO[user.role]?.label} → ${ROLE_INFO[newRole].label}`,
          name !== user.name && `nama ${user.name} → ${name}`,
          (form.employeeId || '') !== (user.employeeId || '') && 'tautan data karyawan',
          form.password && 'kata sandi diganti',
        ].filter(Boolean);
        warehouseDb.updateUser(user.id, {
          name,
          role: newRole,
          employeeId: form.employeeId || undefined,
          nip: form.nip.trim() || undefined,
          phone: form.phone.trim() || undefined,
          password: form.password || undefined,
        });
        if (changes.length > 0) {
          warehouseDb.logActivity(currentUser, 'USER_UPDATED', 'USER', user.id, `Mengubah akun ${name}: ${changes.join(', ')}.`);
        }
        setFeedback({ type: 'success', text: `Akun ${name} diperbarui${form.password ? ', kata sandi diganti' : ''}.` });
      }
      setDialog(null);
      setVersion(v => v + 1);
    } catch (err: any) {
      setFormError(err?.message || 'Gagal menyimpan akun.');
    }
  };

  const askDelete = (user: User) => {
    if (user.id === currentUser.id) {
      setFeedback({ type: 'error', text: 'Akun yang sedang dipakai tidak bisa dihapus.' });
      return;
    }
    if (user.role === 'SUPERADMIN' && superadminCount <= 1) {
      setFeedback({ type: 'error', text: 'Satu-satunya Superadmin tidak bisa dihapus.' });
      return;
    }
    setFormError('');
    setDialog({ mode: 'delete', user });
  };

  // Karyawan yang bisa dipilih: belum punya akun, atau sedang ditautkan ke akun yang diubah.
  const employeeOptions = (currentLink: string): Employee[] =>
    employees
      .filter(e => e.status !== 'NONAKTIF' && (!linkedEmployeeIds.has(e.id) || e.id === currentLink))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));

  const editingSelf = dialog?.mode === 'edit' && dialog.user.id === currentUser.id;
  const originalLink = dialog?.mode === 'edit' ? dialog.user.employeeId || '' : '';

  return (
    <div className="space-y-4">
      {feedback && <Feedback type={feedback.type} text={feedback.text} onClose={() => setFeedback(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <Select className="w-full sm:w-44"
            aria-label="Peran"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as 'ALL' | UserRole)}>
            <option value="ALL">Semua peran ({users.length})</option>
            {ROLES.map(r => (
              <option key={r} value={r}>
                {ROLE_INFO[r].label} ({users.filter(u => u.role === r).length})
              </option>
            ))}
          </Select>
          <div className="relative sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Cari akun"
              placeholder="Cari nama, email, atau NIP"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className={`${FIELD_INPUT} pl-8`}
            />
          </div>
        </div>
        <button type="button" onClick={openCreate} className={BTN_PRIMARY}>
          <Plus className="w-4 h-4" />
          Buat akun
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Akun</th>
                <th className="py-2.5 px-3 font-semibold">Peran</th>
                <th className="py-2.5 px-3 font-semibold">Data karyawan</th>
                <th className="py-2.5 px-4 font-semibold text-right">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-600">
                    Tidak ada akun yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filtered.map(user => {
                  const emp = user.employeeId ? employeeById.get(user.employeeId) : undefined;
                  const isSelf = user.id === currentUser.id;
                  return (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {user.name}
                          {isSelf && <span className="ml-1.5 text-[11px] font-normal text-slate-600">(Anda)</span>}
                        </div>
                        <div className="text-[11px] text-slate-600 font-mono">{user.email}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-slate-900">{ROLE_INFO[user.role]?.label || user.role}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        {emp ? (
                          <>
                            <div className="text-slate-900">{emp.position}</div>
                            <div className="text-[11px] text-slate-600">
                              {emp.department} · <span className="font-mono">{emp.nip}</span>
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-600">Belum ditautkan</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex justify-end gap-1.5">
                          <button type="button" onClick={() => openEdit(user)} aria-label={`Ubah akun ${user.name}`} className={BTN_SECONDARY}>
                            Ubah
                          </button>
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => askDelete(user)}
                              aria-label={`Hapus akun ${user.name}`}
                              className={`${BTN_SECONDARY} border-transparent bg-transparent hover:bg-rose-50 text-rose-800`}
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {dialog?.mode === 'delete' && (
        <FormDialog
          title={`Hapus akun ${dialog.user.name}?`}
          description="Orang ini tidak bisa masuk lagi. Data karyawan dan riwayat aktivitasnya tetap tersimpan."
          onClose={() => setDialog(null)}
          onSubmit={save}
          submitLabel="Hapus akun"
          danger
          error={formError}
        >
          <p className="text-xs text-slate-700">
            {dialog.user.email} · {ROLE_INFO[dialog.user.role]?.label}
          </p>
        </FormDialog>
      )}

      {(dialog?.mode === 'create' || dialog?.mode === 'edit') && (
        <FormDialog
          title={dialog.mode === 'create' ? 'Buat akun' : `Ubah akun ${dialog.user.name}`}
          description={dialog.mode === 'edit' ? dialog.user.email : 'Akun untuk masuk ke aplikasi.'}
          onClose={() => setDialog(null)}
          onSubmit={save}
          submitLabel={dialog.mode === 'create' ? 'Buat akun' : 'Simpan perubahan'}
          error={formError}
        >
          <div>
            <label htmlFor="acc-emp" className={FIELD_LABEL}>Data karyawan</label>
            <Select className="w-full" id="acc-emp" value={form.employeeId} onChange={e => pickEmployee(e.target.value)}>
              <option value="">Tidak ditautkan</option>
              {employeeOptions(originalLink || form.employeeId).map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.position})
                </option>
              ))}
            </Select>
            {dialog.mode === 'edit' && !originalLink && form.employeeId && (
              <p className="text-[11px] text-slate-600 mt-1">Disarankan karena namanya sama. Ganti jika keliru.</p>
            )}
          </div>

          <div>
            <label htmlFor="acc-name" className={FIELD_LABEL}>Nama</label>
            <input id="acc-name" type="text" value={form.name} onChange={e => setField('name', e.target.value)} className={FIELD_INPUT} />
          </div>

          {dialog.mode === 'create' && (
            <div>
              <label htmlFor="acc-email" className={FIELD_LABEL}>Email (untuk masuk)</label>
              <input id="acc-email" type="email" autoComplete="off" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="nama@sppg.id" className={FIELD_INPUT} />
            </div>
          )}

          <div>
            <label htmlFor="acc-role" className={FIELD_LABEL}>Peran</label>
            <Select className="w-full"
              id="acc-role"
              value={form.role}
              disabled={editingSelf}
              onChange={e => setField('role', e.target.value as UserRole)}>
              {ROLES.map(r => (
                <option key={r} value={r}>
                  {ROLE_INFO[r].label}
                </option>
              ))}
            </Select>
            <p className="text-[11px] text-slate-600 mt-1">
              {editingSelf ? 'Peran akun sendiri tidak bisa diubah, agar tidak kehilangan akses.' : ROLE_INFO[form.role].desc}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="acc-nip" className={FIELD_LABEL}>NIP (opsional)</label>
              <input id="acc-nip" type="text" value={form.nip} onChange={e => setField('nip', e.target.value)} className={`${FIELD_INPUT} font-mono`} />
            </div>
            <div>
              <label htmlFor="acc-phone" className={FIELD_LABEL}>No. HP (opsional)</label>
              <input id="acc-phone" type="tel" value={form.phone} onChange={e => setField('phone', e.target.value)} className={`${FIELD_INPUT} font-mono`} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="acc-pw" className={FIELD_LABEL}>
                {dialog.mode === 'create' ? 'Kata sandi' : 'Kata sandi baru'}
              </label>
              <input
                id="acc-pw"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.password}
                onChange={e => setField('password', e.target.value)}
                placeholder={dialog.mode === 'create' ? `Min. ${MIN_PASSWORD} karakter` : 'Kosongkan jika tetap'}
                className={FIELD_INPUT}
              />
            </div>
            <div>
              <label htmlFor="acc-pw2" className={FIELD_LABEL}>Ulangi</label>
              <input
                id="acc-pw2"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.confirm}
                onChange={e => setField('confirm', e.target.value)}
                className={FIELD_INPUT}
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer min-h-[44px] sm:min-h-0">
            <input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} className="w-4 h-4 accent-emerald-700" />
            Tampilkan kata sandi
          </label>
        </FormDialog>
      )}
    </div>
  );
};
