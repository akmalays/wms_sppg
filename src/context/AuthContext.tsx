import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types/warehouse';
import { INITIAL_USERS, warehouseDb } from '../db/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  currentUser: User;
  isAuthenticated: boolean;
  availableUsers: User[];
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  loginAsUser: (userId: string) => void;
  logout: () => void;
  switchUser: (userId: string) => void;
  updateProfile: (updatedData: { name?: string; currentPassword?: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
  registerUser: (userData: {
    name: string;
    email: string;
    role: UserRole;
    password: string;
    phone?: string;
    nip?: string;
  }) => Promise<{ success: boolean; user?: User; error?: string }>;
  can: (action: PermissionAction) => boolean;
}

export type PermissionAction =
  | 'RECEIVE_GOODS'
  | 'APPROVE_OPNAME'
  | 'CREATE_OPNAME'
  | 'MANAGE_ITEMS'
  | 'MANAGE_SUPPLIERS'
  | 'MANAGE_EQUIPMENT'
  | 'RECORD_CONSUMPTION'
  | 'VIEW_AUDIT'
  | 'MANAGE_USERS';

const ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  SUPERADMIN: [
    'RECEIVE_GOODS',
    'APPROVE_OPNAME',
    'CREATE_OPNAME',
    'MANAGE_ITEMS',
    'MANAGE_SUPPLIERS',
    'MANAGE_EQUIPMENT',
    'RECORD_CONSUMPTION',
    'VIEW_AUDIT',
    'MANAGE_USERS',
  ],
  KA_SPPG: [
    'RECEIVE_GOODS',
    'APPROVE_OPNAME',
    'CREATE_OPNAME',
    'MANAGE_ITEMS',
    'MANAGE_SUPPLIERS',
    'MANAGE_EQUIPMENT',
    'RECORD_CONSUMPTION',
    'VIEW_AUDIT',
    'MANAGE_USERS',
  ],
  ADMIN: [
    'RECEIVE_GOODS',
    'CREATE_OPNAME',
    'MANAGE_ITEMS',
    'MANAGE_SUPPLIERS',
    'MANAGE_EQUIPMENT',
    'RECORD_CONSUMPTION',
    'VIEW_AUDIT',
  ],
  ASLAP: [
    'RECEIVE_GOODS',
    'CREATE_OPNAME',
    'MANAGE_EQUIPMENT',
    'RECORD_CONSUMPTION',
  ],
  AKUNTAN: [
    'RECEIVE_GOODS',
    'APPROVE_OPNAME',
    'MANAGE_SUPPLIERS',
    'VIEW_AUDIT',
  ],
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [availableUsers, setAvailableUsers] = useState<User[]>(() => warehouseDb.getUsers());

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const allUsers = warehouseDb.getUsers();
    const saved = localStorage.getItem('sppg_active_user_id');

    // Akun lokal: nama dan peran selalu dari data akun. Peran di localStorage tidak dipercaya,
    // karena bisa diubah siapa pun lewat DevTools browser.
    const found = saved ? allUsers.find(u => u.id === saved) : undefined;
    if (found) return found;

    // Sesi Supabase Auth (ID bukan USR-xxx): profil belum dimuat ulang di sini, jadi pakai data sesi terakhir.
    if (saved && !saved.startsWith('USR-')) {
      return {
        id: saved,
        email: '',
        name: localStorage.getItem('sppg_active_user_name') || 'Petugas',
        role: (localStorage.getItem('sppg_active_user_role') as UserRole) || 'ASLAP',
      };
    }

    return allUsers.find(u => u.role === 'SUPERADMIN') || allUsers[0] || INITIAL_USERS[0];
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('sppg_is_authenticated') === 'true';
  });

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Try Supabase Auth if configured
    if (isSupabaseConfigured() && password) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password,
        });

        if (data?.user && !error) {
          // Attempt reading profile from supabase profiles table
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          const authenticatedUser: User = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            name: profile?.name || data.user.user_metadata?.name || cleanEmail.split('@')[0],
            role: (profile?.role || 'ASLAP') as UserRole,
            avatarUrl: profile?.avatar_url,
          };

          setCurrentUser(authenticatedUser);
          setIsAuthenticated(true);
          localStorage.setItem('sppg_active_user_id', authenticatedUser.id);
          localStorage.setItem('sppg_is_authenticated', 'true');
          return { success: true };
        }
      } catch (err) {
        // Fallback to demo users below if supabase auth user does not exist yet
      }
    }

    // 2. Stored / local users validation
    const verification = warehouseDb.verifyUserCredentials(cleanEmail, password || '');
    if (verification.valid && verification.user) {
      setCurrentUser(verification.user);
      setIsAuthenticated(true);
      localStorage.setItem('sppg_active_user_id', verification.user.id);
      localStorage.setItem('sppg_active_user_name', verification.user.name);
      localStorage.setItem('sppg_active_user_role', verification.user.role);
      localStorage.setItem('sppg_is_authenticated', 'true');
      return { success: true };
    }

    if (verification.error) {
      return {
        success: false,
        error: verification.error,
      };
    }

    return {
      success: false,
      error: 'Email atau nama pengguna tidak terdaftar dalam database petugas.',
    };
  };

  const loginAsUser = (userId: string) => {
    const user = availableUsers.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('sppg_active_user_id', user.id);
      localStorage.setItem('sppg_is_authenticated', 'true');
    }
  };

  const registerUser = async (userData: {
    name: string;
    email: string;
    role: UserRole;
    password: string;
    phone?: string;
    nip?: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      const cleanEmail = userData.email.trim().toLowerCase();
      const currentList = warehouseDb.getUsers();

      if (currentList.some(u => u.email.toLowerCase() === cleanEmail)) {
        return { success: false, error: 'Alamat email tersebut sudah terdaftar dalam sistem.' };
      }

      // Supabase signup if connected
      if (isSupabaseConfigured()) {
        try {
          await supabase.auth.signUp({
            email: cleanEmail,
            password: userData.password,
            options: {
              data: {
                name: userData.name.trim(),
                role: userData.role,
                phone: userData.phone,
                nip: userData.nip,
              },
            },
          });
        } catch (e) {
          // ignore offline
        }
      }

      const newUser = warehouseDb.registerUser({
        name: userData.name,
        email: cleanEmail,
        role: userData.role,
        password: userData.password,
        phone: userData.phone,
        nip: userData.nip,
      });

      const updatedUsers = warehouseDb.getUsers();
      setAvailableUsers(updatedUsers);

      // Auto login the new user
      setCurrentUser(newUser);
      setIsAuthenticated(true);
      localStorage.setItem('sppg_active_user_id', newUser.id);
      localStorage.setItem('sppg_active_user_name', newUser.name);
      localStorage.setItem('sppg_active_user_role', newUser.role);
      localStorage.setItem('sppg_is_authenticated', 'true');

      return { success: true, user: newUser };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal membuat user baru.' };
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        // ignore
      }
    }
    setIsAuthenticated(false);
    localStorage.removeItem('sppg_is_authenticated');
  };

  const switchUser = (roleOrUserId: string) => {
    const user = availableUsers.find(u => u.id === roleOrUserId || u.role === roleOrUserId);
    if (user) {
      setCurrentUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('sppg_active_user_id', user.id);
      localStorage.setItem('sppg_active_user_name', user.name);
      localStorage.setItem('sppg_active_user_role', user.role);
      localStorage.setItem('sppg_is_authenticated', 'true');
    }
  };

  // Peran tidak bisa diubah dari profil sendiri; hanya lewat Kelola Akun (MANAGE_USERS).
  const updateProfile = async (updatedData: {
    name?: string;
    currentPassword?: string;
    password?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const newName = updatedData.name !== undefined ? updatedData.name.trim() : currentUser.name;
      if (!newName) {
        return { success: false, error: 'Nama pengguna tidak boleh kosong.' };
      }

      // Akun lokal ber-ID USR-xxx ada di daftar pengguna aplikasi; selainnya akun Supabase Auth.
      const isLocalAccount = warehouseDb.getUsers().some(u => u.id === currentUser.id);

      if (updatedData.password) {
        if (!updatedData.currentPassword) {
          return { success: false, error: 'Masukkan kata sandi saat ini untuk mengganti kata sandi.' };
        }
        if (isLocalAccount) {
          const check = warehouseDb.verifyUserCredentials(currentUser.email, updatedData.currentPassword);
          if (!check.valid) return { success: false, error: 'Kata sandi saat ini salah.' };
        } else {
          const { error: verifyErr } = await supabase.auth.signInWithPassword({
            email: currentUser.email,
            password: updatedData.currentPassword,
          });
          if (verifyErr) return { success: false, error: 'Kata sandi saat ini salah.' };
          const { error: pwdErr } = await supabase.auth.updateUser({ password: updatedData.password });
          if (pwdErr) return { success: false, error: `Kata sandi gagal diganti: ${pwdErr.message}` };
        }
      }

      if (isLocalAccount) {
        warehouseDb.updateUser(currentUser.id, { name: newName, password: updatedData.password || undefined });
      } else if (isSupabaseConfigured()) {
        const { error: profileErr } = await supabase.from('profiles').update({ name: newName }).eq('id', currentUser.id);
        if (profileErr) return { success: false, error: `Nama gagal disimpan: ${profileErr.message}` };
      }

      const updatedUser: User = { ...currentUser, name: newName };
      setCurrentUser(updatedUser);
      localStorage.setItem('sppg_active_user_name', newName);
      localStorage.setItem('sppg_active_user_id', currentUser.id);
      setAvailableUsers(warehouseDb.getUsers());

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal memperbarui profil.' };
    }
  };

  const can = (action: PermissionAction): boolean => {
    if (!isAuthenticated) return false;
    const permissions = ROLE_PERMISSIONS[currentUser.role] || [];
    return permissions.includes(action);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        availableUsers,
        login,
        loginAsUser,
        logout,
        switchUser,
        updateProfile,
        registerUser,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
