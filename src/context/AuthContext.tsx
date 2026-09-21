import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types/warehouse';
import { INITIAL_USERS } from '../db/storage';

interface AuthContextType {
  currentUser: User;
  availableUsers: User[];
  switchUser: (userId: string) => void;
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
  SUPER_ADMIN: [
    'RECEIVE_GOODS',
    'APPROVE_OPNAME',
    'CREATE_OPNAME',
    'MANAGE_ITEMS',
    'MANAGE_SUPPLIERS',
    'MANAGE_EQUIPMENT',
    'RECORD_CONSUMPTION',
    'VIEW_AUDIT',
  ],
  MANAGER: [
    'APPROVE_OPNAME',
    'CREATE_OPNAME',
    'MANAGE_ITEMS',
    'MANAGE_SUPPLIERS',
    'MANAGE_EQUIPMENT',
    'VIEW_AUDIT',
  ],
  WAREHOUSE_MANAGER: [
    'RECEIVE_GOODS',
    'APPROVE_OPNAME',
    'CREATE_OPNAME',
    'MANAGE_ITEMS',
    'MANAGE_SUPPLIERS',
    'MANAGE_EQUIPMENT',
    'RECORD_CONSUMPTION',
    'VIEW_AUDIT',
  ],
  WAREHOUSE_STAFF: [
    'RECEIVE_GOODS',
    'CREATE_OPNAME',
    'MANAGE_EQUIPMENT',
    'RECORD_CONSUMPTION',
  ],
  PURCHASING: [
    'MANAGE_SUPPLIERS',
  ],
  QC: [
    'RECEIVE_GOODS',
  ],
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('sppg_active_user_id');
    if (saved) {
      const found = INITIAL_USERS.find(u => u.id === saved);
      if (found) return found;
    }
    // Default to Warehouse Manager or Staff for realistic operational testing
    return INITIAL_USERS.find(u => u.role === 'WAREHOUSE_MANAGER') || INITIAL_USERS[0];
  });

  const switchUser = (userId: string) => {
    const user = INITIAL_USERS.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('sppg_active_user_id', user.id);
    }
  };

  const can = (action: PermissionAction): boolean => {
    const permissions = ROLE_PERMISSIONS[currentUser.role] || [];
    return permissions.includes(action);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        availableUsers: INITIAL_USERS,
        switchUser,
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
