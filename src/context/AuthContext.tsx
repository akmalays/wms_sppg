import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types/warehouse';
import { INITIAL_USERS } from '../db/storage';
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
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('sppg_active_user_id');
    const savedName = localStorage.getItem('sppg_active_user_name');
    const savedRole = localStorage.getItem('sppg_active_user_role') as UserRole;
    if (saved) {
      const found = INITIAL_USERS.find(u => u.id === saved);
      if (found) {
        return {
          ...found,
          name: savedName || found.name,
          role: savedRole || found.role,
        };
      }
    }
    // Default fallback to Admin or Ka SPPG
    const def = INITIAL_USERS.find(u => u.role === 'ADMIN') || INITIAL_USERS[0];
    return {
      ...def,
      name: savedName || def.name,
      role: savedRole || def.role,
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

    // 2. Demo accounts validation
    const matchedUser = INITIAL_USERS.find(
      u => u.email.toLowerCase() === cleanEmail
    );

    if (matchedUser) {
      setCurrentUser(matchedUser);
      setIsAuthenticated(true);
      localStorage.setItem('sppg_active_user_id', matchedUser.id);
      localStorage.setItem('sppg_is_authenticated', 'true');
      return { success: true };
    }

    return {
      success: false,
      error: 'Email tidak ditemukan dalam sistem. Gunakan salah satu email akun demo SPPG atau akun Supabase yang valid.',
    };
  };

  const loginAsUser = (userId: string) => {
    const user = INITIAL_USERS.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('sppg_active_user_id', user.id);
      localStorage.setItem('sppg_is_authenticated', 'true');
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

  const switchUser = (userId: string) => {
    const user = INITIAL_USERS.find(u => u.id === userId);
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
      const idx = INITIAL_USERS.findIndex(u => u.id === currentUser.id);
      if (idx >= 0) {
        INITIAL_USERS[idx].name = newName;
        INITIAL_USERS[idx].role = newRole;
      }

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
        availableUsers: INITIAL_USERS,
        login,
        loginAsUser,
        logout,
        switchUser,
        updateProfile,
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
