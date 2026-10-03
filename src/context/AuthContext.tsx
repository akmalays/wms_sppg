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
  updateProfile: (updatedData: { name?: string; role?: UserRole; password?: string }) => Promise<{ success: boolean; error?: string }>;
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
  | 'VIEW_AUDIT';

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
    let saved = localStorage.getItem('sppg_active_user_id');
    let savedName = localStorage.getItem('sppg_active_user_name');
    let savedRole = localStorage.getItem('sppg_active_user_role') as UserRole;

    if (savedName === 'Hendra Wijaya') {
      savedName = 'Akmal';
      savedRole = 'ADMIN';
      localStorage.setItem('sppg_active_user_name', 'Akmal');
      localStorage.setItem('sppg_active_user_role', 'ADMIN');
      localStorage.setItem('sppg_active_user_id', 'USR-003');
    }

    // Akmal is always ADMIN (USR-003)
    if (savedName === 'Akmal') {
      savedRole = 'ADMIN';
      saved = 'USR-003';
      localStorage.setItem('sppg_active_user_name', 'Akmal');
      localStorage.setItem('sppg_active_user_role', 'ADMIN');
      localStorage.setItem('sppg_active_user_id', 'USR-003');
    }

    if (saved) {
      const found = allUsers.find(u => u.id === saved);
      if (found) {
        return {
          ...found,
          name: savedName || found.name,
          role: found.id === 'USR-003' || savedName === 'Akmal' ? 'ADMIN' : (savedRole || found.role),
        };
      }
    }
    // Default fallback to Admin (Akmal)
    const def = allUsers.find(u => u.id === 'USR-003' || u.role === 'ADMIN') || allUsers[0] || INITIAL_USERS[2];
    return {
      ...def,
      id: 'USR-003',
      name: 'Akmal',
      role: 'ADMIN',
    };
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
    const matchedUser = availableUsers.find(
      u => u.email.toLowerCase() === cleanEmail ||
           (u.role === 'ADMIN' && (cleanEmail === 'akmal' || cleanEmail === 'akmal@sppg.id' || cleanEmail === 'akmal.admin@sppg.id' || cleanEmail === 'hendra.admin@sppg.id'))
    );

    if (matchedUser) {
      const savedPassword = warehouseDb.getUserPassword(cleanEmail);
      if (savedPassword && password && savedPassword !== password) {
        return {
          success: false,
          error: 'Kata sandi yang Anda masukkan salah.',
        };
      }

      setCurrentUser(matchedUser);
      setIsAuthenticated(true);
      localStorage.setItem('sppg_active_user_id', matchedUser.id);
      localStorage.setItem('sppg_is_authenticated', 'true');
      return { success: true };
    }

    return {
      success: false,
      error: 'Email tidak ditemukan dalam sistem. Gunakan salah satu email akun demo SPPG atau buat akun petugas baru.',
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

  const updateProfile = async (updatedData: {
    name?: string;
    role?: UserRole;
    password?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const newName = updatedData.name ? updatedData.name.trim() : currentUser.name;
      const newRole = updatedData.role || currentUser.role;

      if (!newName) {
        return { success: false, error: 'Nama pengguna tidak boleh kosong.' };
      }

      // 1. Supabase Auth password & profile sync if active
      if (isSupabaseConfigured()) {
        if (updatedData.password) {
          const { error: pwdErr } = await supabase.auth.updateUser({ password: updatedData.password });
          if (pwdErr) {
            console.warn('Supabase password update error:', pwdErr.message);
          }
        }
        try {
          await supabase
            .from('profiles')
            .update({ name: newName, role: newRole })
            .eq('id', currentUser.id);
        } catch (e) {
          // ignore offline
        }
      }

      // 2. Update state & local storage
      const updatedUser: User = {
        ...currentUser,
        name: newName,
        role: newRole,
      };

      setCurrentUser(updatedUser);
      localStorage.setItem('sppg_active_user_name', newName);
      localStorage.setItem('sppg_active_user_role', newRole);
      localStorage.setItem('sppg_active_user_id', currentUser.id);

      // Cache update
      const updatedList = warehouseDb.getUsers().map(u => {
        if (u.id === currentUser.id) {
          return { ...u, name: newName, role: newRole };
        }
        return u;
      });
      setAvailableUsers(updatedList);

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
