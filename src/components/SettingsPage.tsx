import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Settings as SettingsIcon, 
  Users, 
  LayoutDashboard, 
  UserCheck, 
  MessageSquare, 
  PlusCircle, 
  Trash2, 
  Pencil, 
  X, 
  Check, 
  Search, 
  ShieldCheck, 
  KeyRound 
} from 'lucide-react';
import { SchoolSettings, ExpenseType, Employee, Unit, DBUser, OperationType } from '../types';
import { SchoolSettingsView } from './SchoolSettingsView';
import { WhatsAppSettings } from './WhatsAppSettings';
import { Firestore, addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { safeAlert, safeConfirm } from '../lib/utils';
import { handleFirestoreError } from '../lib/error-handler';

export type SettingsSubTab = 'school' | 'users' | 'units' | 'expenses' | 'employees' | 'whatsapp';

interface SettingsPageProps {
  activeSubTab?: SettingsSubTab;
  onSubTabChange?: (tab: SettingsSubTab) => void;
  schoolSettings: SchoolSettings;
  onSaveSchoolSettings: (data: SchoolSettings) => Promise<void>;
  expenseTypes: ExpenseType[];
  employees: Employee[];
  units: Unit[];
  db: Firestore;
  userEmail: string;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  activeSubTab = 'school',
  onSubTabChange,
  schoolSettings,
  onSaveSchoolSettings,
  expenseTypes,
  employees,
  units,
  db,
  userEmail,
}) => {
  const [currentTab, setCurrentTab] = useState<SettingsSubTab>(activeSubTab);

  useEffect(() => {
    if (activeSubTab) {
      setCurrentTab(activeSubTab);
    }
  }, [activeSubTab]);

  const handleTabClick = (tab: SettingsSubTab) => {
    setCurrentTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  return (
    <div className="space-y-8">
      {/* Settings Navigation Header */}
      <div className="bg-white p-6 sm:p-8 rounded-[36px] border border-natural-border shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-natural-border/60">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-natural-primary/10 text-natural-primary flex items-center justify-center border border-natural-primary/20">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-serif italic text-natural-primary">Pengaturan Sistem</h2>
              <p className="text-xs text-natural-secondary mt-0.5">
                Pusat pengelolaan identitas sekolah, akun pengguna, unit kerja, jenis pengeluaran, pegawai, dan notifikasi WA
              </p>
            </div>
          </div>
        </div>

        {/* 6 Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pt-6 scrollbar-none">
          <button
            onClick={() => handleTabClick('school')}
            className={`px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
              currentTab === 'school'
                ? 'bg-natural-primary text-white shadow-md'
                : 'bg-natural-bg/60 text-natural-secondary hover:bg-natural-bg hover:text-natural-primary border border-natural-border/50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Setting Sekolah
          </button>

          <button
            onClick={() => handleTabClick('users')}
            className={`px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
              currentTab === 'users'
                ? 'bg-natural-primary text-white shadow-md'
                : 'bg-natural-bg/60 text-natural-secondary hover:bg-natural-bg hover:text-natural-primary border border-natural-border/50'
            }`}
          >
            <Users className="w-4 h-4" />
            Daftar Akun
          </button>

          <button
            onClick={() => handleTabClick('units')}
            className={`px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
              currentTab === 'units'
                ? 'bg-natural-primary text-white shadow-md'
                : 'bg-natural-bg/60 text-natural-secondary hover:bg-natural-bg hover:text-natural-primary border border-natural-border/50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Daftar Unit
          </button>

          <button
            onClick={() => handleTabClick('expenses')}
            className={`px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
              currentTab === 'expenses'
                ? 'bg-natural-primary text-white shadow-md'
                : 'bg-natural-bg/60 text-natural-secondary hover:bg-natural-bg hover:text-natural-primary border border-natural-border/50'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            Jenis Pengeluaran
          </button>

          <button
            onClick={() => handleTabClick('employees')}
            className={`px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
              currentTab === 'employees'
                ? 'bg-natural-primary text-white shadow-md'
                : 'bg-natural-bg/60 text-natural-secondary hover:bg-natural-bg hover:text-natural-primary border border-natural-border/50'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Daftar Pegawai
          </button>

          <button
            onClick={() => handleTabClick('whatsapp')}
            className={`px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
              currentTab === 'whatsapp'
                ? 'bg-natural-primary text-white shadow-md'
                : 'bg-natural-bg/60 text-natural-secondary hover:bg-natural-bg hover:text-natural-primary border border-natural-border/50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Notifikasi WA
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {currentTab === 'school' && (
        <SchoolSettingsView
          schoolSettings={schoolSettings}
          onSave={onSaveSchoolSettings}
        />
      )}

      {currentTab === 'users' && (
        <InlineUsersSettings db={db} units={units} />
      )}

      {currentTab === 'units' && (
        <InlineUnitsSettings db={db} units={units} />
      )}

      {currentTab === 'expenses' && (
        <InlineExpenseSettings types={expenseTypes} db={db} />
      )}

      {currentTab === 'employees' && (
        <InlineEmployeeSettings employees={employees} db={db} />
      )}

      {currentTab === 'whatsapp' && (
        <WhatsAppSettings db={db} userEmail={userEmail} />
      )}
    </div>
  );
};

/* ========================================================================= */
/* 1. Sub-component for Users Settings (Daftar Akun with Add & Edit)       */
/* ========================================================================= */
const InlineUsersSettings: React.FC<{ db: Firestore; units: Unit[] }> = ({ db, units }) => {
  const [usersList, setUsersList] = useState<DBUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<DBUser | null>(null);

  // Form states for Add & Edit
  const [formData, setFormData] = useState({
    username: '',
    pass: '',
    displayName: '',
    unitName: '',
    role: 'user' as 'admin' | 'user'
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'app_users'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as DBUser));
      setUsersList(data);
      setLoading(false);
    }, (err) => {
      console.warn("Users listener error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  const handleOpenAdd = () => {
    setFormData({
      username: '',
      pass: '',
      displayName: '',
      unitName: '',
      role: 'user'
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (user: DBUser) => {
    setEditingUser(user);
    setFormData({
      username: user.username || '',
      pass: user.pass || '',
      displayName: user.displayName || '',
      unitName: user.unitName || '',
      role: user.role || 'user'
    });
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.pass) {
      safeAlert('Username dan password wajib diisi');
      return;
    }
    try {
      await addDoc(collection(db, 'app_users'), {
        username: formData.username.toLowerCase(),
        pass: formData.pass,
        displayName: formData.displayName || formData.unitName || 'Pengguna',
        unitName: formData.unitName,
        role: formData.role
      });

      // Sync unit to collection if not existing
      if (formData.unitName) {
        const existingUnit = units.find(u => u.name.toLowerCase() === formData.unitName.toLowerCase());
        if (!existingUnit) {
          await addDoc(collection(db, 'units'), { name: formData.unitName });
        }
      }

      setShowAddModal(false);
      safeAlert('Akun pengguna berhasil ditambahkan!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'app_users');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editingUser.id) return;
    if (!formData.username || !formData.pass) {
      safeAlert('Username dan password tidak boleh kosong');
      return;
    }
    try {
      await updateDoc(doc(db, 'app_users', editingUser.id), {
        username: formData.username.toLowerCase(),
        pass: formData.pass,
        displayName: formData.displayName || formData.unitName || 'Pengguna',
        unitName: formData.unitName,
        role: formData.role
      });
      setEditingUser(null);
      safeAlert('Data akun berhasil diperbarui!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `app_users/${editingUser.id}`);
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (safeConfirm(`Hapus akun ${username}?`)) {
      try {
        await deleteDoc(doc(db, 'app_users', id));
        safeAlert(`Akun ${username} telah dihapus.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `app_users/${id}`);
      }
    }
  };

  const filteredUsers = usersList.filter(u => 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.unitName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-8 rounded-[40px] border border-natural-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-serif italic text-natural-primary">Kelola Daftar Akun Pengguna</h3>
          <p className="text-xs text-natural-secondary mt-0.5">
            Tambah, perbarui data (edit), atau hapus akun pengguna sistem
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-natural-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari akun atau unit..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-full text-xs font-medium focus:bg-white focus:outline-hidden focus:border-natural-primary"
            />
          </div>
          <button
            onClick={handleOpenAdd}
            className="bg-natural-primary text-white px-6 py-2.5 rounded-full font-serif italic text-xs font-bold hover:bg-natural-primary/90 transition-all shadow-md flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" />
            Tambah Akun
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-[40px] border border-natural-border shadow-sm overflow-hidden">
        <div className="px-8 py-5 bg-natural-bg/30 border-b border-natural-border/60 flex items-center justify-between">
          <p className="text-[10px] uppercase font-bold text-natural-secondary tracking-widest">
            Daftar Akun Terdaftar ({filteredUsers.length})
          </p>
        </div>

        {loading ? (
          <div className="p-16 text-center text-natural-secondary italic text-xs">Memuat data akun...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center text-natural-secondary italic text-xs">Tidak ada data akun pengguna.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-natural-bg/40 border-b border-natural-border/50 text-[10px] font-bold text-natural-secondary uppercase tracking-widest">
                  <th className="px-8 py-4">No</th>
                  <th className="px-8 py-4">Nama Tampilan / Unit</th>
                  <th className="px-8 py-4">Username</th>
                  <th className="px-8 py-4">Password</th>
                  <th className="px-8 py-4">Role</th>
                  <th className="px-8 py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-natural-border/40 text-xs">
                {filteredUsers.map((u, idx) => (
                  <tr key={u.id} className="hover:bg-natural-bg/40 transition-all">
                    <td className="px-8 py-4 font-mono text-natural-secondary text-[11px]">{idx + 1}</td>
                    <td className="px-8 py-4 font-bold text-natural-primary">
                      {u.displayName}
                      {u.unitName && u.unitName !== u.displayName && (
                        <span className="block text-[10px] font-normal text-natural-secondary mt-0.5">Unit: {u.unitName}</span>
                      )}
                    </td>
                    <td className="px-8 py-4 font-mono font-medium text-natural-primary">{u.username}</td>
                    <td className="px-8 py-4 font-mono text-natural-secondary">{u.pass}</td>
                    <td className="px-8 py-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'admin'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}>
                        {u.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <KeyRound className="w-3 h-3" />}
                        {u.role === 'admin' ? 'Bendahara (Admin)' : 'Unit Kerja'}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-2 text-natural-primary hover:bg-natural-bg rounded-xl transition-all cursor-pointer border border-natural-border/50"
                          title="Edit Akun"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => u.id && handleDeleteUser(u.id, u.username)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer border border-red-200/50"
                          title="Hapus Akun"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[36px] p-8 max-w-lg w-full border border-natural-border shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-natural-border/60 pb-4">
              <h3 className="font-serif italic font-bold text-xl text-natural-primary">Tambah Akun Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 text-natural-secondary hover:text-natural-primary cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-natural-primary uppercase text-[10px] tracking-wider mb-1">
                  Username *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. tu_smk, kesiswaan"
                  className="w-full p-3.5 bg-natural-bg/50 border border-natural-border rounded-xl font-mono focus:bg-white focus:outline-hidden focus:border-natural-primary"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-bold text-natural-primary uppercase text-[10px] tracking-wider mb-1">
                  Password *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Password akun"
                  className="w-full p-3.5 bg-natural-bg/50 border border-natural-border rounded-xl font-mono focus:bg-white focus:outline-hidden focus:border-natural-primary"
                  value={formData.pass}
                  onChange={e => setFormData({ ...formData, pass: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-bold text-natural-primary uppercase text-[10px] tracking-wider mb-1">
                  Nama Tampilan
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tata Usaha, Kesiswaan"
                  className="w-full p-3.5 bg-natural-bg/50 border border-natural-border rounded-xl font-medium focus:bg-white focus:outline-hidden focus:border-natural-primary"
                  value={formData.displayName}
                  onChange={e => setFormData({ ...formData, displayName: e.target.value, unitName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-natural-primary uppercase text-[10px] tracking-wider mb-1">
                    Unit Kerja
                  </label>
                  <select
                    className="w-full p-3.5 bg-natural-bg/50 border border-natural-border rounded-xl font-medium focus:bg-white focus:outline-hidden focus:border-natural-primary"
                    value={formData.unitName}
                    onChange={e => setFormData({ ...formData, unitName: e.target.value, displayName: formData.displayName || e.target.value })}
                  >
                    <option value="">Pilih Unit...</option>
                    {units.map(u => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-natural-primary uppercase text-[10px] tracking-wider mb-1">
                    Role System
                  </label>
                  <select
                    className="w-full p-3.5 bg-natural-bg/50 border border-natural-border rounded-xl font-medium focus:bg-white focus:outline-hidden focus:border-natural-primary"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                  >
                    <option value="user">Unit Kerja (User)</option>
                    <option value="admin">Bendahara (Admin)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-natural-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-full border border-natural-border text-natural-secondary font-bold hover:bg-natural-bg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-natural-primary text-white font-bold hover:bg-natural-primary/90 shadow-md cursor-pointer"
                >
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[36px] p-8 max-w-lg w-full border border-natural-border shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-natural-border/60 pb-4">
              <div>
                <h3 className="font-serif italic font-bold text-xl text-natural-primary">Edit Akun Pengguna</h3>
                <p className="text-[10px] text-natural-secondary">Perbarui informasi tanpa menghapus akun</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-2 text-natural-secondary hover:text-natural-primary cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-natural-primary uppercase text-[10px] tracking-wider mb-1">
                  Username *
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-3.5 bg-natural-bg/50 border border-natural-border rounded-xl font-mono focus:bg-white focus:outline-hidden focus:border-natural-primary"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-bold text-natural-primary uppercase text-[10px] tracking-wider mb-1">
                  Password *
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-3.5 bg-natural-bg/50 border border-natural-border rounded-xl font-mono focus:bg-white focus:outline-hidden focus:border-natural-primary"
                  value={formData.pass}
                  onChange={e => setFormData({ ...formData, pass: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-bold text-natural-primary uppercase text-[10px] tracking-wider mb-1">
                  Nama Tampilan
                </label>
                <input
                  type="text"
                  className="w-full p-3.5 bg-natural-bg/50 border border-natural-border rounded-xl font-medium focus:bg-white focus:outline-hidden focus:border-natural-primary"
                  value={formData.displayName}
                  onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-natural-primary uppercase text-[10px] tracking-wider mb-1">
                    Unit Kerja
                  </label>
                  <select
                    className="w-full p-3.5 bg-natural-bg/50 border border-natural-border rounded-xl font-medium focus:bg-white focus:outline-hidden focus:border-natural-primary"
                    value={formData.unitName}
                    onChange={e => setFormData({ ...formData, unitName: e.target.value })}
                  >
                    <option value="">Pilih Unit...</option>
                    {units.map(u => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-natural-primary uppercase text-[10px] tracking-wider mb-1">
                    Role System
                  </label>
                  <select
                    className="w-full p-3.5 bg-natural-bg/50 border border-natural-border rounded-xl font-medium focus:bg-white focus:outline-hidden focus:border-natural-primary"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                  >
                    <option value="user">Unit Kerja (User)</option>
                    <option value="admin">Bendahara (Admin)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-natural-border">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-5 py-2.5 rounded-full border border-natural-border text-natural-secondary font-bold hover:bg-natural-bg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-natural-primary text-white font-bold hover:bg-natural-primary/90 shadow-md cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ========================================================================= */
/* 2. Sub-component for Units Settings (Daftar Unit with Add & Edit)         */
/* ========================================================================= */
const InlineUnitsSettings: React.FC<{ db: Firestore; units: Unit[] }> = ({ db, units }) => {
  const [newUnitName, setNewUnitName] = useState('');
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editName, setEditName] = useState('');

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim()) return;
    try {
      const existing = units.find(u => u.name.toLowerCase() === newUnitName.trim().toLowerCase());
      if (existing) {
        safeAlert('Unit kerja sudah terdaftar');
        return;
      }
      await addDoc(collection(db, 'units'), { name: newUnitName.trim() });
      setNewUnitName('');
      safeAlert('Unit kerja berhasil ditambahkan!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'units');
    }
  };

  const handleOpenEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setEditName(unit.name);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit || !editingUnit.id || !editName.trim()) return;
    try {
      await updateDoc(doc(db, 'units', editingUnit.id), {
        name: editName.trim()
      });
      setEditingUnit(null);
      safeAlert('Nama unit kerja berhasil diperbarui!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `units/${editingUnit.id}`);
    }
  };

  const handleDeleteUnit = async (id: string, name: string) => {
    if (safeConfirm(`Hapus unit kerja "${name}"? Data laporan tidak akan terhapus.`)) {
      try {
        await deleteDoc(doc(db, 'units', id));
        safeAlert(`Unit kerja "${name}" telah dihapus.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `units/${id}`);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Form Tambah */}
      <div className="bg-white p-8 sm:p-10 rounded-[40px] border border-natural-border shadow-sm">
        <h3 className="text-2xl font-serif italic text-natural-primary mb-6">Tambah Unit Kerja Baru</h3>
        <form onSubmit={handleAddUnit} className="flex flex-col sm:flex-row gap-4">
          <input
            required
            className="flex-1 p-4 bg-natural-bg/50 border border-natural-border rounded-2xl text-xs font-bold text-natural-primary focus:bg-white focus:outline-hidden focus:border-natural-primary"
            placeholder="Masukkan nama unit kerja (e.g. Unit Tata Usaha, Kesiswaan)..."
            value={newUnitName}
            onChange={e => setNewUnitName(e.target.value)}
          />
          <button type="submit" className="bg-natural-primary text-white px-8 py-4 rounded-full font-serif italic text-xs font-bold hover:bg-natural-primary/90 transition-all shadow-md cursor-pointer whitespace-nowrap">
            Tambah Unit
          </button>
        </form>
      </div>

      {/* Grid List Units */}
      <div className="bg-white rounded-[40px] border border-natural-border shadow-sm overflow-hidden">
        <div className="px-10 py-6 bg-natural-bg/30 border-b border-natural-border/60 flex items-center justify-between">
          <p className="text-[10px] uppercase font-bold text-natural-secondary tracking-widest">
            Daftar Unit Kerja Terdaftar ({units.length})
          </p>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.length === 0 ? (
            <div className="col-span-full py-12 text-center text-natural-secondary italic text-xs">
              Belum ada unit kerja terdaftar.
            </div>
          ) : (
            units.map(unit => (
              <div
                key={unit.id}
                className="p-5 bg-natural-bg/40 border border-natural-border/70 rounded-3xl flex items-center justify-between hover:border-natural-primary/50 transition-all group"
              >
                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                  <div className="w-10 h-10 bg-natural-primary/10 rounded-2xl flex items-center justify-center text-natural-primary flex-shrink-0 border border-natural-primary/20">
                    <LayoutDashboard className="w-4 h-4" />
                  </div>
                  <span className="font-serif italic font-bold text-natural-primary text-sm truncate">{unit.name}</span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleOpenEdit(unit)}
                    className="p-2 text-natural-primary hover:bg-white rounded-xl transition-all cursor-pointer border border-natural-border/50"
                    title="Edit Unit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => unit.id && handleDeleteUnit(unit.id, unit.name)}
                    className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer border border-red-100"
                    title="Hapus Unit"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Unit Modal */}
      {editingUnit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[36px] p-8 max-w-md w-full border border-natural-border shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-natural-border/60 pb-4">
              <h3 className="font-serif italic font-bold text-xl text-natural-primary">Edit Nama Unit Kerja</h3>
              <button onClick={() => setEditingUnit(null)} className="p-2 text-natural-secondary hover:text-natural-primary cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-natural-primary uppercase text-[10px] tracking-wider mb-1">
                  Nama Unit Kerja
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-3.5 bg-natural-bg/50 border border-natural-border rounded-xl font-bold text-natural-primary focus:bg-white focus:outline-hidden focus:border-natural-primary"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-natural-border">
                <button
                  type="button"
                  onClick={() => setEditingUnit(null)}
                  className="px-5 py-2.5 rounded-full border border-natural-border text-natural-secondary font-bold hover:bg-natural-bg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-natural-primary text-white font-bold hover:bg-natural-primary/90 shadow-md cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ========================================================================= */
/* 3. Sub-component for Expense Settings (with Add & Edit)                   */
/* ========================================================================= */
const InlineExpenseSettings: React.FC<{ types: ExpenseType[]; db: Firestore }> = ({ types, db }) => {
  const [newName, setNewName] = useState('');
  const [editingItem, setEditingItem] = useState<ExpenseType | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await addDoc(collection(db, 'expense_types'), { name: newName.trim() });
      setNewName('');
      safeAlert('Jenis pengeluaran berhasil ditambahkan!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'expense_types');
    }
  };

  const handleOpenEdit = (item: ExpenseType) => {
    setEditingItem(item);
    setEditName(item.name);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.id || !editName.trim()) return;
    try {
      await updateDoc(doc(db, 'expense_types', editingItem.id), {
        name: editName.trim()
      });
      setEditingItem(null);
      safeAlert('Jenis pengeluaran berhasil diperbarui!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `expense_types/${editingItem.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (safeConfirm('Hapus kategori pengeluaran ini?')) {
      try {
        await deleteDoc(doc(db, 'expense_types', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `expense_types/${id}`);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="bg-white p-8 sm:p-10 rounded-[40px] border border-natural-border shadow-sm">
        <h3 className="text-2xl font-serif italic text-natural-primary mb-6">Pengaturan Jenis Pengeluaran</h3>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-4">
          <input
            className="flex-1 p-4 bg-natural-bg/50 border border-natural-border rounded-2xl text-xs focus:bg-white focus:outline-hidden focus:border-natural-primary font-medium"
            placeholder="Tambah jenis baru (e.g. Alat Tulis, Transport, Konsumsi)..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <button type="submit" className="bg-natural-primary text-white px-8 py-4 rounded-full font-serif italic text-xs font-bold hover:bg-natural-primary/90 transition-all shadow-md cursor-pointer whitespace-nowrap">
            Simpan Baru
          </button>
        </form>
      </div>

      <div className="bg-white rounded-[40px] border border-natural-border shadow-sm overflow-hidden">
        <div className="px-10 py-6 bg-natural-bg/30 border-b border-natural-border/60">
          <p className="text-[10px] uppercase font-bold text-natural-secondary tracking-widest">Kategori Aktif ({types.length})</p>
        </div>
        <div className="divide-y divide-natural-border/40">
          {types.length === 0 ? (
            <div className="p-10 text-center text-natural-secondary italic text-xs">Belum ada kategori pengeluaran.</div>
          ) : (
            types.map(t => (
              <div key={t.id} className="px-10 py-4 flex justify-between items-center group hover:bg-natural-bg/50 transition-all text-xs">
                <span className="font-medium text-natural-primary">{t.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(t)}
                    className="p-2 text-natural-primary hover:bg-white rounded-xl transition-all cursor-pointer border border-natural-border/50"
                    title="Edit Kategori"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => t.id && handleDelete(t.id)}
                    className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer border border-red-100"
                    title="Hapus Kategori"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[36px] p-8 max-w-md w-full border border-natural-border shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-natural-border/60 pb-4">
              <h3 className="font-serif italic font-bold text-xl text-natural-primary">Edit Kategori Pengeluaran</h3>
              <button onClick={() => setEditingItem(null)} className="p-2 text-natural-secondary hover:text-natural-primary cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-natural-primary uppercase text-[10px] tracking-wider mb-1">
                  Nama Jenis Pengeluaran
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-3.5 bg-natural-bg/50 border border-natural-border rounded-xl font-bold text-natural-primary focus:bg-white focus:outline-hidden focus:border-natural-primary"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-natural-border">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-5 py-2.5 rounded-full border border-natural-border text-natural-secondary font-bold hover:bg-natural-bg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-natural-primary text-white font-bold hover:bg-natural-primary/90 shadow-md cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ========================================================================= */
/* 4. Sub-component for Employee Settings (with Add & Edit)                  */
/* ========================================================================= */
const InlineEmployeeSettings: React.FC<{ employees: Employee[]; db: Firestore }> = ({ employees, db }) => {
  const [formData, setFormData] = useState({ name: '' });
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    try {
      await addDoc(collection(db, 'employees'), { name: formData.name.trim() });
      setFormData({ name: '' });
      safeAlert('Pegawai berhasil ditambahkan!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'employees');
    }
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setEditName(emp.name);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee || !editingEmployee.id || !editName.trim()) return;
    try {
      await updateDoc(doc(db, 'employees', editingEmployee.id), {
        name: editName.trim()
      });
      setEditingEmployee(null);
      safeAlert('Data pegawai berhasil diperbarui!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `employees/${editingEmployee.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (safeConfirm('Hapus pegawai ini dari daftar?')) {
      try {
        await deleteDoc(doc(db, 'employees', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `employees/${id}`);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="bg-white p-8 sm:p-10 rounded-[40px] border border-natural-border shadow-sm">
        <h3 className="text-2xl font-serif italic text-natural-primary mb-6">Kelola Daftar Pegawai</h3>
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 space-y-1.5 focus-within:text-natural-primary">
            <label className="text-[9px] uppercase font-bold text-natural-secondary/60 ml-2">Nama Lengkap Pegawai</label>
            <input
              required
              className="w-full p-4 bg-natural-bg/50 border border-natural-border rounded-2xl text-xs font-bold text-natural-primary focus:bg-white focus:outline-hidden focus:border-natural-primary"
              placeholder="e.g. Drs. Ahmad Fauzi, M.Pd."
              value={formData.name}
              onChange={e => setFormData({ name: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="w-full md:w-auto bg-natural-primary text-white px-8 py-4 rounded-full font-serif italic text-xs font-bold hover:bg-natural-primary/90 transition-all shadow-md cursor-pointer whitespace-nowrap">
              Simpan Pegawai
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-[40px] border border-natural-border shadow-sm overflow-hidden">
        <div className="px-10 py-6 bg-natural-bg/30 border-b border-natural-border/60">
          <p className="text-[10px] uppercase font-bold text-natural-secondary tracking-widest">Daftar Pegawai Terdaftar ({employees.length})</p>
        </div>
        <div className="divide-y divide-natural-border/40">
          {employees.length === 0 ? (
            <div className="p-10 text-center text-natural-secondary italic text-xs">Belum ada pegawai terdaftar.</div>
          ) : (
            employees.map(emp => (
              <div key={emp.id} className="px-10 py-4 flex justify-between items-center group hover:bg-natural-bg/50 transition-all text-xs">
                <span className="font-bold text-natural-primary">{emp.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(emp)}
                    className="p-2 text-natural-primary hover:bg-white rounded-xl transition-all cursor-pointer border border-natural-border/50"
                    title="Edit Pegawai"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => emp.id && handleDelete(emp.id)}
                    className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer border border-red-100"
                    title="Hapus Pegawai"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[36px] p-8 max-w-md w-full border border-natural-border shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-natural-border/60 pb-4">
              <h3 className="font-serif italic font-bold text-xl text-natural-primary">Edit Data Pegawai</h3>
              <button onClick={() => setEditingEmployee(null)} className="p-2 text-natural-secondary hover:text-natural-primary cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-natural-primary uppercase text-[10px] tracking-wider mb-1">
                  Nama Lengkap Pegawai
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-3.5 bg-natural-bg/50 border border-natural-border rounded-xl font-bold text-natural-primary focus:bg-white focus:outline-hidden focus:border-natural-primary"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-natural-border">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-5 py-2.5 rounded-full border border-natural-border text-natural-secondary font-bold hover:bg-natural-bg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-natural-primary text-white font-bold hover:bg-natural-primary/90 shadow-md cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
