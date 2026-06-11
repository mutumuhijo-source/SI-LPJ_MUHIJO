/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, serverTimestamp, addDoc, getDocs, deleteDoc, limit, orderBy } from 'firebase/firestore';
import { Report, ReportStatus, Unit, OperationType, ExpenseType, ExpenseDetail, Employee } from './types.ts';
import { handleFirestoreError } from './lib/error-handler.ts';
import { 
  LayoutDashboard, 
  PlusCircle, 
  LogOut, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User as UserIcon,
  Users,
  Search,
  ArrowLeft,
  FileText,
  AlertCircle,
  Lock,
  UserCircle2,
  Trash2,
  Printer,
  Settings,
  RotateCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Auth Utilities & Data ---

interface AppUser {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
  unitName: string;
}

interface DBUser {
  id?: string;
  username: string;
  pass: string;
  role: 'admin' | 'user';
  displayName: string;
  unitName: string;
}

const BOOTSTRAP_USERS: DBUser[] = [
  { username: 'admin', pass: 'mutugo123', role: 'admin', displayName: 'Bendahara Utama', unitName: 'Bendahara' },
  { username: 'tu', pass: 'tu123', role: 'user', displayName: 'Tata Usaha', unitName: 'Tata Usaha' },
  { username: 'kur', pass: 'kur123', role: 'user', displayName: 'Kurikulum', unitName: 'Kurikulum' },
  { username: 'kesis', pass: 'kesis123', role: 'user', displayName: 'Kesiswaan', unitName: 'Kesiswaan' },
  { username: 'hum', pass: 'hum123', role: 'user', displayName: 'Humas', unitName: 'Humas' },
  { username: 'sarp', pass: 'sarp123', role: 'user', displayName: 'Sarana Prasarana', unitName: 'Sarpras' },
];

// --- Context ---
interface AuthContextType {
  user: AppUser | null;
  isAdmin: boolean;
  loading: boolean;
  login: (u: string, p: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  isAdmin: false, 
  loading: true,
  login: async () => false,
  logout: () => {}
});

// --- Components ---

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-natural-bg">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-natural-primary"></div>
  </div>
);

const Navbar = ({ onLogout }: { onLogout: () => void }) => {
  const { user, isAdmin } = useContext(AuthContext);
  return (
    <nav className="bg-natural-primary text-white border-b border-natural-primary/20 px-8 py-5 flex justify-between items-center sticky top-0 z-50 shadow-md">
      <div className="flex items-center gap-4">
        <div className="bg-natural-secondary p-2.5 rounded-full flex items-center justify-center w-11 h-11 font-serif text-xl italic shadow-inner">
          S
        </div>
        <div>
          <h1 className="text-2xl font-serif italic tracking-tight leading-none">Sistem Pelaporan Unit Kerja</h1>
          <span className="text-[10px] font-sans not-italic font-light opacity-80 uppercase tracking-widest block mt-1">Bendahara Sekolah</span>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        {user && (
          <div className="flex items-center gap-4 pr-6 border-r border-white/20">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-none">{user.displayName}</p>
              <p className="text-[10px] opacity-70 uppercase tracking-wider mt-1">{isAdmin ? 'Bendahara Utama' : user.unitName}</p>
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-natural-secondary bg-natural-bg/10 overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-natural-secondary" />
                </div>
              )}
            </div>
          </div>
        )}
        <button 
          onClick={onLogout}
          className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
};

const StatusBadge = ({ status }: { status: ReportStatus }) => {
  const configs = {
    [ReportStatus.BUDGET_PROPOSAL]: { color: 'bg-[#fcf8e3] text-amber-700 border-amber-200', icon: Clock, label: 'Pengajuan Anggaran' },
    [ReportStatus.BUDGET_APPROVED]: { color: 'bg-[#ebf5e9] text-green-700 border-green-200', icon: CheckCircle2, label: 'Anggaran Disetujui' },
    [ReportStatus.REPORTING]: { color: 'bg-[#e0f7fa] text-blue-700 border-blue-200', icon: FileText, label: 'Proses Pelaporan' },
    [ReportStatus.COMPLETED]: { color: 'bg-[#e8f5e9] text-emerald-700 border-emerald-200', icon: CheckCircle2, label: 'Selesai' },
    [ReportStatus.ARCHIVED]: { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Lock, label: 'Arsip' },
    [ReportStatus.REJECTED]: { color: 'bg-[#fbeaea] text-red-700 border-red-200', icon: XCircle, label: 'Ditolak' },
    [ReportStatus.REVISION]: { color: 'bg-[#fff4e5] text-orange-700 border-orange-200', icon: RotateCw, label: 'Revisi Diperlukan' },
  };
  const config = configs[status];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
};

// --- Views ---

const LoginPage = () => {
  const { login } = useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const success = await login(username, password);
    if (!success) {
      setError('Username atau Password salah');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-natural-bg p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[40px] p-12 shadow-xl border border-natural-border"
      >
        <div className="text-center mb-10">
          <div className="bg-natural-primary w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-natural-primary/10">
            <FileText className="text-white w-9 h-9" />
          </div>
          <h2 className="text-3xl font-serif italic text-natural-primary tracking-tight mb-2">E-Lapor</h2>
          <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-[0.2em] mb-4">SMK MUH 1 NGADIREJO</p>
          <p className="text-natural-secondary text-xs font-light">Sistem Pelaporan Dana Unit Kerja</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-natural-secondary flex items-center gap-2">
              <UserCircle2 className="w-3 h-3" /> Username
            </label>
            <input 
              required
              type="text"
              className="w-full p-4 bg-natural-input border-b-2 border-natural-bg focus:border-natural-primary outline-none transition-all font-medium"
              placeholder="Masukkan username..."
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-natural-secondary flex items-center gap-2">
              <Lock className="w-3 h-3" /> Password
            </label>
            <input 
              required
              type="password"
              className="w-full p-4 bg-natural-input border-b-2 border-natural-bg focus:border-natural-primary outline-none transition-all font-medium"
              placeholder="Masukkan password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="text-red-500 text-xs font-bold uppercase tracking-wider text-center"
            >
              {error}
            </motion.p>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-natural-primary text-white font-serif italic text-xl py-4 rounded-full hover:bg-natural-primary/90 transition-all active:scale-[0.98] shadow-lg shadow-natural-primary/20 disabled:opacity-50"
          >
            {loading ? 'Memverifikasi...' : 'Masuk ke Sistem'}
          </button>
        </form>
        
        <p className="mt-10 text-[10px] text-natural-secondary uppercase tracking-[0.2em] font-bold text-center">
          Pusat Data Pertanggungjawaban
        </p>
      </motion.div>
    </div>
  );
};

const ReportForm = ({ onCancel, onSuccess, user, editReport, units, expenseTypes, employees, onPrintRAB }: { onCancel: () => void, onSuccess: () => void, user: AppUser, editReport?: Report, units: Unit[], expenseTypes: ExpenseType[], employees: Employee[], onPrintRAB?: (r: Report) => void }) => {
  const isAdmin = localStorage.getItem('user_role') === 'admin';
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    unitId: editReport?.unitId || '',
    unitName: editReport?.unitName || '',
    activityName: editReport?.activityName || '',
    amountReceived: editReport?.amountReceived || 0,
    proposedDetails: editReport?.proposedDetails || [{ category: '', description: '', amount: 0 }],
    details: editReport?.details || [],
    ketuaName: editReport?.ketuaName || '',
    ketuaJabatan: editReport?.ketuaJabatan || '',
    bendaharaName: editReport?.bendaharaName || '',
    bendaharaJabatan: editReport?.bendaharaJabatan || '',
    submissionDate: editReport?.submissionDate || new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!editReport && !formData.unitId && !isAdmin) {
      const matched = units.find(u => u.name === user.unitName);
      if (matched) setFormData(prev => ({ ...prev, unitId: matched.id, unitName: matched.name }));
    }
  }, [units, user.unitName, editReport, isAdmin, formData.unitId]);

  const updateProposedDetails = (newDetails: ExpenseDetail[]) => {
    const total = newDetails.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    setFormData(prev => ({ ...prev, proposedDetails: newDetails, amountReceived: total }));
  };

  const addDetail = (isProposed: boolean) => {
    if (isProposed) {
      updateProposedDetails([...formData.proposedDetails, { date: new Date().toISOString().split('T')[0], description: '', amount: 0, category: '' }]);
    } else {
      setFormData({ ...formData, details: [...formData.details, { date: new Date().toISOString().split('T')[0], description: '', amount: 0, proposedIndex: undefined }] });
    }
  };

  const removeDetail = (index: number, isProposed: boolean) => {
    if (isProposed) {
      const newDetails = [...formData.proposedDetails];
      newDetails.splice(index, 1);
      updateProposedDetails(newDetails);
    } else {
      const newDetails = [...formData.details];
      newDetails.splice(index, 1);
      setFormData({ ...formData, details: newDetails });
    }
  };

  const totalSpent = formData.details.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unitId || !formData.activityName) return;

    setLoading(true);
    try {
      const selectedUnit = units.find(u => u.id === formData.unitId);
      const getNextStatus = () => {
        if (!editReport) return ReportStatus.BUDGET_PROPOSAL;
        if (editReport.status === ReportStatus.REVISION) {
          // If revision, check if it was for budget or report
          return editReport.details.length > 0 ? ReportStatus.REPORTING : ReportStatus.BUDGET_PROPOSAL;
        }
        return editReport.status;
      };

      const payload = {
        unitId: formData.unitId,
        unitName: selectedUnit?.name || formData.unitName || 'Unknown',
        activityName: formData.activityName,
        amountReceived: Number(formData.amountReceived),
        totalSpent: totalSpent,
        details: formData.details,
        proposedDetails: formData.proposedDetails,
        status: getNextStatus(),
        submittedAt: editReport?.submittedAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        submittedBy: editReport?.submittedBy || user.uid,
        ketuaName: formData.ketuaName,
        ketuaJabatan: formData.ketuaJabatan,
        bendaharaName: formData.bendaharaName,
        bendaharaJabatan: formData.bendaharaJabatan,
        submissionDate: formData.submissionDate
      };

      if (editReport?.id) {
        await setDoc(doc(db, 'reports', editReport.id), payload as any, { merge: true });
      } else {
        await addDoc(collection(db, 'reports'), payload as any);
      }
      onSuccess();
    } catch (err) {
      handleFirestoreError(err, editReport?.id ? OperationType.UPDATE : OperationType.CREATE, editReport?.id ? `reports/${editReport.id}` : 'reports');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl mx-auto py-10"
    >
      <div className="flex items-center gap-6 mb-10">
        <button type="button" onClick={onCancel} className="p-3 hover:bg-white rounded-full transition-colors border border-natural-border bg-white shadow-sm">
          <ArrowLeft className="w-5 h-5 text-natural-primary" />
        </button>
        <div className="flex-1">
          <h2 className="text-3xl font-serif italic text-natural-primary tracking-tight">
            {isAdmin ? (editReport ? 'Revisi Alokasi Anggaran' : 'Sediakan Pagu Anggaran Baru') : (editReport ? 'Lengkapi Rincian Pengeluaran' : 'Pelaporan Mandiri')}
          </h2>
          <p className="text-natural-secondary text-xs uppercase tracking-widest font-bold mt-1">
            {isAdmin ? 'Tetapkan pagu dana untuk unit kerja terkait' : 'Input item pengeluaran sesuai realisasi lapangan'}
          </p>
        </div>
        {editReport && onPrintRAB && (
          <button
            type="button"
            onClick={() => onPrintRAB(editReport)}
            className="p-3 bg-[#e8f5e9] border border-[#a5d6a7] text-[#2e7d32] rounded-full hover:bg-[#c8e6c9] transition-all shadow-sm flex items-center gap-2 px-6 font-bold uppercase text-[10px] tracking-widest"
          >
            <Printer className="w-4 h-4" />
            Cetak RAB Disetujui
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white p-10 rounded-[32px] border border-natural-border shadow-sm space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-1.5 focus-within:text-natural-primary transition-colors">
              <label className="text-[10px] uppercase tracking-wider font-bold">Unit Kerja Penerima Mandat</label>
              <select 
                required
                disabled={!isAdmin && !!editReport && editReport.status !== ReportStatus.BUDGET_PROPOSAL && editReport.status !== ReportStatus.REVISION}
                className="w-full p-4 bg-natural-input border-b-2 border-natural-bg text-sm font-bold focus:bg-white focus:border-natural-primary transition-all outline-none disabled:opacity-60"
                value={formData.unitId}
                onChange={(e) => setFormData({...formData, unitId: e.target.value})}
              >
                <option value="">Pilih Unit...</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 focus-within:text-natural-primary transition-colors">
              <label className="text-[10px] uppercase tracking-wider font-bold">Tanggal Pengajuan</label>
              <input 
                type="date"
                required
                className="w-full p-4 bg-natural-input border-b-2 border-natural-bg text-sm font-bold focus:bg-white focus:border-natural-primary outline-none"
                value={formData.submissionDate}
                onChange={(e) => setFormData({...formData, submissionDate: e.target.value})}
              />
            </div>
            <div className="space-y-1.5 focus-within:text-natural-primary transition-colors">
              <label className="text-[10px] uppercase tracking-wider font-bold">Pejabat Penanda Tangan 1</label>
              <input 
                required
                className="w-full p-4 bg-natural-input border-b-2 border-natural-bg text-sm font-bold focus:bg-white focus:border-natural-primary outline-none"
                value={formData.ketuaName}
                placeholder="Nama"
                onChange={(e) => setFormData({...formData, ketuaName: e.target.value})}
              />
              <input 
                required
                className="w-full p-4 bg-natural-input border-b-2 border-natural-bg text-sm font-bold focus:bg-white focus:border-natural-primary outline-none"
                value={formData.ketuaJabatan}
                placeholder="Jabatan"
                onChange={(e) => setFormData({...formData, ketuaJabatan: e.target.value})}
              />
            </div>
            <div className="space-y-1.5 focus-within:text-natural-primary transition-colors">
              <label className="text-[10px] uppercase tracking-wider font-bold">Pejabat Penanda Tangan 2</label>
              <input 
                required
                className="w-full p-4 bg-natural-input border-b-2 border-natural-bg text-sm font-bold focus:bg-white focus:border-natural-primary outline-none"
                value={formData.bendaharaName}
                placeholder="Nama"
                onChange={(e) => setFormData({...formData, bendaharaName: e.target.value})}
              />
              <input 
                required
                className="w-full p-4 bg-natural-input border-b-2 border-natural-bg text-sm font-bold focus:bg-white focus:border-natural-primary outline-none"
                value={formData.bendaharaJabatan}
                placeholder="Jabatan"
                onChange={(e) => setFormData({...formData, bendaharaJabatan: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1.5 focus-within:text-natural-primary transition-colors">
            <label className="text-[10px] uppercase tracking-wider font-bold">Judul / Kode Kegiatan</label>
            <input 
              required
              disabled={!isAdmin && !!editReport && editReport.status !== ReportStatus.BUDGET_PROPOSAL && editReport.status !== ReportStatus.REVISION}
              className="w-full p-4 bg-natural-input border-b-2 border-natural-bg text-xl font-serif italic focus:bg-white focus:border-natural-primary outline-none disabled:opacity-60"
              placeholder="Contoh: Operasional TU Tahap I..."
              value={formData.activityName}
              onChange={(e) => setFormData({...formData, activityName: e.target.value})}
            />
          </div>

          <div className="space-y-1.5 focus-within:text-natural-primary transition-colors">
            <label className="text-[10px] uppercase tracking-wider font-bold">Alokasi Anggaran (Pagu)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-natural-secondary font-mono text-xs">IDR</span>
              <input 
                type="number"
                required
                disabled={!isAdmin}
                className="w-full pl-14 p-5 bg-natural-input border-b-2 border-natural-bg text-3xl font-mono font-bold text-natural-primary focus:bg-white focus:border-natural-primary outline-none disabled:opacity-60"
                value={formData.amountReceived}
                onChange={(e) => setFormData({...formData, amountReceived: parseInt(e.target.value) || 0})}
              />
            </div>
          </div>
        </div>

        {/* Proposed Details */}
        <div className="bg-white p-10 rounded-[32px] border border-natural-border shadow-sm space-y-8">
            <div className="flex justify-between items-center border-b border-natural-bg pb-6">
              <div>
                <h3 className="font-serif italic text-2xl text-natural-primary">Rincian Anggaran (Usulan)</h3>
                <p className="text-[10px] uppercase font-bold text-natural-secondary tracking-widest mt-1">Item belanja yang diusulkan</p>
              </div>
              {!!editReport && editReport.status !== ReportStatus.BUDGET_PROPOSAL && editReport.status !== ReportStatus.REVISION ? (
                <span className="text-[10px] uppercase font-bold text-emerald-700 px-3 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
                  Sudah Final
                </span>
              ) : (
                <button 
                  type="button"
                  onClick={() => addDetail(true)}
                  className="px-6 py-2.5 bg-natural-primary text-white text-[11px] uppercase font-bold rounded-full hover:bg-natural-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-natural-primary/20"
                >
                  <PlusCircle className="w-4 h-4" />
                  Baris Baru Usul
                </button>
              )}
            </div>
 
            <div className="space-y-4">
              {formData.proposedDetails.map((detail, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-natural-bg/20 p-6 rounded-[24px] border border-natural-bg relative group">
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[9px] uppercase font-bold text-natural-secondary/60">Kategori</label>
                    <select 
                      required
                      disabled={!!editReport && editReport.status !== ReportStatus.BUDGET_PROPOSAL && editReport.status !== ReportStatus.REVISION}
                      className="w-full p-2 bg-white rounded-xl border border-natural-border outline-none text-xs font-bold disabled:bg-natural-bg/50 disabled:text-natural-secondary/70"
                      value={detail.category || ''}
                      onChange={(e) => {
                        const newD = [...formData.proposedDetails];
                        newD[idx].category = e.target.value;
                        updateProposedDetails(newD);
                      }}
                    >
                      <option value="">Pilih...</option>
                      {expenseTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-5 space-y-1">
                    <label className="text-[9px] uppercase font-bold text-natural-secondary/60">Deskripsi Pengeluaran</label>
                    <input 
                      required
                      disabled={!!editReport && editReport.status !== ReportStatus.BUDGET_PROPOSAL && editReport.status !== ReportStatus.REVISION}
                      className="w-full p-2 bg-white rounded-xl border border-natural-border outline-none text-xs font-medium disabled:bg-natural-bg/50 disabled:text-natural-secondary/70"
                      placeholder="Masukkan rincian..."
                      value={detail.description}
                      onChange={(e) => {
                        const newD = [...formData.proposedDetails];
                        newD[idx].description = e.target.value;
                        updateProposedDetails(newD);
                      }}
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[9px] uppercase font-bold text-natural-secondary/60 text-right block">Nominal</label>
                    <input 
                      type="number"
                      required
                      disabled={!!editReport && editReport.status !== ReportStatus.BUDGET_PROPOSAL && editReport.status !== ReportStatus.REVISION}
                      className="w-full p-2 bg-white rounded-xl border border-natural-border outline-none font-mono font-bold text-xs text-right disabled:bg-natural-bg/50 disabled:text-natural-secondary/70"
                      value={detail.amount}
                      onChange={(e) => {
                        const newD = [...formData.proposedDetails];
                        newD[idx].amount = parseInt(e.target.value) || 0;
                        updateProposedDetails(newD);
                      }}
                    />
                  </div>
                  <div className="md:col-span-1 flex justify-center pb-1">
                    {(!editReport || editReport.status === ReportStatus.BUDGET_PROPOSAL || editReport.status === ReportStatus.REVISION) && formData.proposedDetails.length > 1 && (
                      <button 
                        type="button"
                        onClick={() => removeDetail(idx, true)}
                        className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
        </div>

        {/* Actual Details */}
        {(editReport?.status === ReportStatus.REPORTING || editReport?.status === ReportStatus.COMPLETED || (editReport?.status === ReportStatus.REVISION && editReport.details.length > 0)) && (
          <div className="bg-white p-10 rounded-[32px] border border-natural-border shadow-sm space-y-8">
            <div className="flex justify-between items-center border-b border-natural-bg pb-6">
              <div>
                <h3 className="font-serif italic text-2xl text-natural-primary">Input Rincian Realisasi</h3>
                <p className="text-[10px] uppercase font-bold text-natural-secondary tracking-widest mt-1">Sertakan tanggal, deskripsi yang jelas, dan pilih pagu anggaran acuan</p>
              </div>
              {!isAdmin && (
                <button 
                  type="button"
                  onClick={() => addDetail(false)}
                  className="px-6 py-2.5 bg-emerald-600 text-white text-[11px] uppercase font-bold rounded-full hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-700/20"
                >
                  <PlusCircle className="w-4 h-4" />
                  Baris Baru Realisasi
                </button>
              )}
            </div>

            {/* Live Pagu Balance Tracker */}
            <div className="border border-natural-border p-5 rounded-2xl bg-natural-bg/10 space-y-3">
              <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-[0.2em]">Sisa Pagu per Item Anggaran</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {formData.proposedDetails.map((p, pIdx) => {
                  const realizedSum = formData.details
                    .filter(d => d.proposedIndex === pIdx)
                    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
                  const remaining = p.amount - realizedSum;
                  return (
                    <div key={pIdx} className="bg-white p-3 rounded-xl border border-natural-border flex justify-between items-center">
                      <div>
                        <p className="font-bold text-natural-primary">{p.description || `Anggaran #${pIdx + 1}`}</p>
                        <p className="text-[10px] text-natural-secondary">Pagu: Rp {p.amount.toLocaleString('id-ID')}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono font-bold ${remaining < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          Sisa: Rp {remaining.toLocaleString('id-ID')}
                        </p>
                        <p className="text-[10px] text-natural-secondary">Realisasi: Rp {realizedSum.toLocaleString('id-ID')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              {formData.details.map((detail, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-natural-bg/20 p-6 rounded-[24px] border border-natural-bg relative group">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[9px] uppercase font-bold text-natural-secondary/60">Tgl</label>
                    <input 
                      type="date"
                      required
                      disabled={isAdmin}
                      className="w-full p-2 bg-white rounded-xl border border-natural-border outline-none text-xs font-bold disabled:bg-transparent"
                      value={detail.date}
                      onChange={(e) => {
                        const newD = [...formData.details];
                        newD[idx].date = e.target.value;
                        setFormData({...formData, details: newD});
                      }}
                    />
                  </div>

                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[9px] uppercase font-bold text-natural-secondary/60">Pilih Pagu Anggaran</label>
                    <select
                      required
                      disabled={isAdmin}
                      className="w-full p-2 bg-white rounded-xl border border-natural-border outline-none text-xs font-bold disabled:bg-transparent"
                      value={detail.proposedIndex !== undefined ? detail.proposedIndex : ''}
                      onChange={(e) => {
                        const newD = [...formData.details];
                        newD[idx].proposedIndex = e.target.value !== '' ? parseInt(e.target.value) : undefined;
                        setFormData({...formData, details: newD});
                      }}
                    >
                      <option value="">Pilih Anggaran...</option>
                       {formData.proposedDetails.map((p, pIdx) => {
                         const realizedSum = formData.details
                           .filter(d => d.proposedIndex === pIdx)
                           .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
                         const remaining = p.amount - realizedSum;
                         return (
                           <option key={pIdx} value={pIdx}>
                             {p.description || `Anggaran #${pIdx + 1}`} (Sisa: Rp {remaining.toLocaleString('id-ID')})
                           </option>
                         );
                       })}
                    </select>
                  </div>

                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[9px] uppercase font-bold text-natural-secondary/60">Deskripsi Realisasi</label>
                    <input 
                      required
                      disabled={isAdmin}
                      className="w-full p-2 bg-white rounded-xl border border-natural-border outline-none text-xs font-medium disabled:bg-transparent"
                      placeholder="Masukkan rincian..."
                      value={detail.description}
                      onChange={(e) => {
                        const newD = [...formData.details];
                        newD[idx].description = e.target.value;
                        setFormData({...formData, details: newD});
                      }}
                    />
                  </div>

                  {/* Employee Selection if category implies personnel expense */}
                  {detail.proposedIndex !== undefined && 
                   formData.proposedDetails[detail.proposedIndex]?.category?.toLowerCase().includes('pegawai') && (
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[9px] uppercase font-bold text-natural-secondary/60">Pegawai (Penerima)</label>
                      <select
                        className="w-full p-2 bg-white rounded-xl border border-natural-border outline-none text-xs font-bold disabled:bg-transparent"
                        disabled={isAdmin}
                        value={detail.employeeId || ''}
                        onChange={(e) => {
                          const newD = [...formData.details];
                          const emp = employees.find(emp => emp.id === e.target.value);
                          newD[idx].employeeId = e.target.value;
                          newD[idx].employeeName = emp?.name || '';
                          setFormData({...formData, details: newD});
                        }}
                      >
                        <option value="">Pilih Pegawai...</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="md:col-span-1 space-y-1">
                    <label className="text-[9px] uppercase font-bold text-natural-secondary/60 text-right block">Nominal</label>
                    <input 
                      type="number"
                      required
                      disabled={isAdmin}
                      className="w-full p-2 bg-white rounded-xl border border-natural-border outline-none font-mono font-bold text-xs text-right disabled:bg-transparent"
                      value={detail.amount}
                      onChange={(e) => {
                        const newD = [...formData.details];
                        newD[idx].amount = parseInt(e.target.value) || 0;
                        setFormData({...formData, details: newD});
                      }}
                    />
                  </div>

                  <div className="md:col-span-1 flex justify-center pb-1">
                    {!isAdmin && (
                      <button 
                        type="button"
                        onClick={() => removeDetail(idx, false)}
                        className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center bg-natural-primary/5 p-6 rounded-[24px]">
               <div className="space-y-1">
                 <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-widest italic">Total Realisasi</p>
                 <p className="text-3xl font-mono font-bold text-natural-primary">Rp {totalSpent.toLocaleString('id-ID')}</p>
               </div>
               <div className="text-right space-y-1">
                 <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-widest italic">Sisa Anggaran</p>
                 <p className={`text-xl font-mono font-bold ${formData.amountReceived - totalSpent < 0 ? 'text-red-500' : 'text-natural-secondary'}`}>
                   Rp {(formData.amountReceived - totalSpent).toLocaleString('id-ID')}
                 </p>
               </div>
            </div>
          </div>
        )}

        <div className="flex gap-6">
          <button 
            type="button"
            onClick={onCancel}
            className="flex-1 py-4 bg-white border border-natural-border text-natural-primary rounded-full font-serif italic text-lg hover:bg-natural-input transition-all"
          >
            Batalkan
          </button>
          <button 
            disabled={loading}
            type="submit" 
            className="flex-1 py-4 bg-natural-primary text-white rounded-full font-serif italic text-lg shadow-xl shadow-natural-primary/20 hover:bg-natural-primary/90 transition-all flex items-center justify-center gap-2"
          >
            {loading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />}
            {editReport ? 'Simpan Perubahan Laporan' : (isAdmin ? 'Terbitkan Mandat Anggaran' : 'Kirim Pengajuan Anggaran')}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

const ReportTable = ({ reports, isAdmin, allowedStatuses, onSelect, onPrint, onPrintRAB, onDelete }: { reports: Report[], isAdmin: boolean, allowedStatuses: ReportStatus[], onSelect: (r: Report) => void, onPrint: (r: Report) => void, onPrintRAB?: (r: Report) => void, onDelete: (r: Report) => void }) => {
  const filteredReports = reports.filter(r => allowedStatuses.includes(r.status));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {filteredReports.length === 0 ? (
        <div className="col-span-full py-32 text-center bg-white rounded-[40px] border border-dashed border-natural-border shadow-inner">
          <div className="bg-natural-bg w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-natural-secondary/40" />
          </div>
          <p className="text-natural-secondary font-serif italic text-xl">Belum ada aktivitas.</p>
        </div>
      ) : (
        filteredReports.map(report => (
          <motion.div 
            key={report.id}
            whileHover={{ y: -6, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
            className="bg-white p-8 rounded-[32px] border border-natural-border shadow-sm transition-all cursor-pointer flex flex-col h-full group"
          >
            <div className="flex justify-between items-start mb-6">
              <StatusBadge status={report.status} />
              <div className="flex gap-2">
                {onPrintRAB && (report.status === ReportStatus.REPORTING || report.status === ReportStatus.COMPLETED || report.status === ReportStatus.ARCHIVED) && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onPrintRAB(report); }}
                    className="p-2 bg-[#e8f5e9] hover:bg-[#2e7d32] hover:text-white rounded-full transition-all text-[#2e7d32]"
                    title="Cetak RAB Disetujui"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); onPrint(report); }}
                  className="p-2 bg-natural-bg hover:bg-natural-primary hover:text-white rounded-full transition-all text-natural-secondary"
                  title={allowedStatuses.includes(ReportStatus.BUDGET_PROPOSAL) ? "Cetak RAB" : "Cetak Laporan"}
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(report); }}
                  className="p-2 bg-red-50 hover:bg-red-500 hover:text-white rounded-full transition-all text-red-500"
                  title="Hapus"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic self-center">
                </span>
              </div>
            </div>
            
            <div onClick={() => onSelect(report)} className="flex-1">
              <h3 className="text-xl font-serif italic text-natural-primary leading-tight mb-2 group-hover:text-natural-secondary transition-colors underline decoration-natural-border/50 underline-offset-4">{report.activityName}</h3>
              <p className="text-[11px] font-bold text-natural-secondary uppercase tracking-widest">{report.unitName}</p>
              
              <div className="mt-8 pt-6 border-t border-natural-bg space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-natural-secondary/40 uppercase tracking-widest block">{allowedStatuses.includes(ReportStatus.REPORTING) || allowedStatuses.includes(ReportStatus.COMPLETED) ? 'Realisasi' : 'Anggaran'}</span>
                    <span className="font-mono font-bold text-natural-primary text-xl tracking-tight">Rp {(allowedStatuses.includes(ReportStatus.REPORTING) || allowedStatuses.includes(ReportStatus.COMPLETED) ? report.totalSpent : report.amountReceived).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between items-center bg-natural-bg/30 p-2 rounded-full px-4 group-hover:bg-natural-primary group-hover:text-white transition-all text-[#a5a58d]">
                    <span className="text-[9px] font-bold uppercase tracking-[0.3em]">Buka Detail</span>
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
};

const ReportDetail = ({ report, onBack, isAdmin, onEdit, onPrint, onPrintRAB, onUpdateStatus }: { report: Report, onBack: () => void, isAdmin: boolean, onEdit: () => void, onPrint: () => void, onPrintRAB?: (r: Report) => void, onUpdateStatus: (id: string, s: ReportStatus, n?: string) => Promise<void> }) => {
  const [notes, setNotes] = useState(report.treasurerNotes || '');
  const [updating, setUpdating] = useState(false);

  const handleUpdateStatusAction = async (status: ReportStatus) => {
    if (!report.id) return;
    setUpdating(true);
    try {
      await onUpdateStatus(report.id, status, notes);
      onBack();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const balance = report.amountReceived - report.totalSpent;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-5xl mx-auto py-10 px-4"
    >
      <div className="flex items-center gap-6 mb-10">
        <button onClick={onBack} className="p-3 hover:bg-white rounded-full transition-colors border border-natural-border bg-white shadow-sm">
          <ArrowLeft className="w-5 h-5 text-natural-primary" />
        </button>
        <div className="flex-1">
          <h2 className="text-4xl font-serif italic text-natural-primary leading-tight">{report.activityName}</h2>
          <p className="text-natural-secondary text-sm uppercase tracking-[0.2em] font-light mt-1">{report.unitName}</p>
        </div>
        <div className="flex items-center gap-4">
           {onPrintRAB && (report.status === ReportStatus.REPORTING || report.status === ReportStatus.COMPLETED || report.status === ReportStatus.ARCHIVED) && (
             <button 
               onClick={() => onPrintRAB(report)}
               className="p-3 bg-[#e8f5e9] border border-[#a5d6a7] text-[#2e7d32] rounded-full hover:bg-[#c8e6c9] transition-all shadow-sm flex items-center gap-2 px-6 font-bold uppercase text-[10px] tracking-widest"
             >
               <Printer className="w-4 h-4" />
               Cetak RAB Disetujui
             </button>
           )}
           <button 
             onClick={onPrint}
             className="p-3 bg-white border border-natural-border text-natural-primary rounded-full hover:bg-natural-input transition-all shadow-sm flex items-center gap-2 px-6 font-bold uppercase text-[10px] tracking-widest"
           >
             <Printer className="w-4 h-4" />
             {report.status === ReportStatus.BUDGET_PROPOSAL || report.status === ReportStatus.BUDGET_APPROVED || report.status === ReportStatus.REJECTED ? 'Cetak RAB' : 'Cetak Laporan'}
           </button>
           <StatusBadge status={report.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
        <div className="bg-white p-8 rounded-[32px] border border-natural-border shadow-sm">
          <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-widest mb-2 italic">Dana Dari Bendahara</p>
          <p className="text-3xl font-mono font-bold text-natural-primary">Rp {report.amountReceived.toLocaleString('id-ID')}</p>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-natural-border shadow-sm">
          <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-widest mb-2 italic">Total Penggunaan</p>
          <p className="text-3xl font-mono font-bold text-natural-primary">Rp {report.totalSpent.toLocaleString('id-ID')}</p>
        </div>
        <div className={`p-8 rounded-[32px] border ${balance >= 0 ? 'bg-natural-bg/50 border-natural-secondary/20' : 'bg-red-50 border-red-100'}`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 italic ${balance >= 0 ? 'text-natural-secondary' : 'text-red-500'}`}>
            {balance >= 0 ? 'Sisa Saldo di Unit' : 'Defisit Anggaran'}
          </p>
          <p className={`text-3xl font-mono font-bold ${balance >= 0 ? 'text-natural-primary' : 'text-red-700'}`}>
            Rp {Math.abs(balance).toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-natural-border shadow-sm overflow-hidden mb-10">
          <div className="px-10 py-8 border-b border-natural-bg flex justify-between items-end">
            <div>
              <h3 className="font-serif italic text-2xl text-natural-primary">Rincian Anggaran (Usulan)</h3>
              <p className="text-natural-secondary text-xs uppercase tracking-widest font-bold mt-1">Proposed Budget Details</p>
            </div>
          </div>
          <div className="p-0">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-natural-bg/30">
                  <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] w-20 italic">#</th>
                  <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic">Deskripsi Item</th>
                  <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] text-right italic">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-natural-bg/50">
                {(report.proposedDetails || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-natural-input transition-colors">
                    <td className="px-10 py-6 font-mono text-xs text-natural-secondary">{String(idx + 1).padStart(2, '0')}</td>
                    <td className="px-10 py-6 text-natural-text font-medium italic">"{item.description}"</td>
                    <td className="px-10 py-6 text-natural-primary font-mono font-bold text-right text-lg">Rp {item.amount.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-10 py-10 grid grid-cols-2 gap-10 border-t border-natural-bg">
            <div className="text-center">
              <p className="text-sm font-bold text-natural-secondary uppercase tracking-widest mb-2 italic">Pejabat Penanda Tangan 1</p>
              <p className="text-sm font-bold mb-1">{report.ketuaJabatan}</p>
              <p className="text-sm font-bold border-b border-natural-bg inline-block px-4">{report.ketuaName}</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-natural-secondary uppercase tracking-widest mb-2 italic">Pejabat Penanda Tangan 2</p>
              <p className="text-sm font-bold mb-1">{report.bendaharaJabatan}</p>
              <p className="text-sm font-bold border-b border-natural-bg inline-block px-4">{report.bendaharaName}</p>
            </div>
            <div className="col-span-2 text-center mt-5">
              <p className="text-sm text-natural-secondary italic">Mengetahui, {report.unitName}</p>
              <p className="text-xs text-natural-secondary uppercase tracking-widest mt-2">{report.submissionDate ? `Dibuat pada: ${new Date(report.submissionDate).toLocaleDateString('id-ID', { dateStyle: 'long' })}` : ''}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[40px] border border-natural-border shadow-sm overflow-hidden mb-10">
          <div className="px-10 py-8 border-b border-natural-bg flex justify-between items-end">
            <div>
              <h3 className="font-serif italic text-2xl text-natural-primary">Rincian Laporan</h3>
              <p className="text-natural-secondary text-xs uppercase tracking-widest font-bold mt-1">Itemized Expense Report</p>
            </div>
          </div>
          {!isAdmin && (report.status === ReportStatus.BUDGET_PROPOSAL || report.status === ReportStatus.REPORTING || report.status === ReportStatus.REVISION) && (
            <button 
              onClick={onEdit}
              className="bg-natural-primary text-white px-6 py-2 rounded-full font-serif italic text-sm hover:bg-natural-primary/90 transition-all shadow-md"
            >
              Lengkapi / Edit Rincian
            </button>
          )}
          {isAdmin && report.status === ReportStatus.BUDGET_APPROVED && (
            <button 
              onClick={() => handleUpdateStatusAction(ReportStatus.REPORTING)}
              className="bg-natural-secondary text-white px-6 py-2 rounded-full font-serif italic text-sm hover:bg-natural-secondary/90 transition-all shadow-md"
            >
              Mulai Input Realisasi
            </button>
          )}
          {isAdmin && report.status === ReportStatus.COMPLETED && (
            <div className="flex gap-2">
              <button 
                onClick={() => handleUpdateStatusAction(ReportStatus.REVISION)}
                className="bg-orange-600 text-white px-6 py-2 rounded-full font-serif italic text-sm hover:bg-orange-700 transition-all shadow-md"
              >
                Revisi Laporan
              </button>
              <button 
                onClick={() => handleUpdateStatusAction(ReportStatus.ARCHIVED)}
                className="bg-natural-primary text-white px-6 py-2 rounded-full font-serif italic text-sm hover:bg-natural-primary/90 transition-all shadow-md"
              >
                Setujui Laporan (Arsipkan)
              </button>
            </div>
          )}
          {isAdmin && report.status === ReportStatus.REPORTING && (
            <div className="flex gap-2">
              <button 
                onClick={() => handleUpdateStatusAction(ReportStatus.REVISION)}
                className="bg-orange-600 text-white px-6 py-2 rounded-full font-serif italic text-sm hover:bg-orange-700 transition-all shadow-md"
              >
                Instruksikan Revisi
              </button>
              <button 
                onClick={() => handleUpdateStatusAction(ReportStatus.COMPLETED)}
                className="bg-emerald-600 text-white px-6 py-2 rounded-full font-serif italic text-sm hover:bg-emerald-700 transition-all shadow-md"
              >
                Selesaikan Laporan
              </button>
            </div>
          )}
          <div className="p-0">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-natural-bg/30">
                  <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] w-20 italic">#</th>
                  <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic">Tanggal</th>
                  <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic">Deskripsi Item</th>
                  <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] text-right italic">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-natural-bg/50">
                {report.details.map((item, idx) => (
                  <tr key={idx} className="hover:bg-natural-input transition-colors">
                    <td className="px-10 py-6 font-mono text-xs text-natural-secondary">{String(idx + 1).padStart(2, '0')}</td>
                    <td className="px-10 py-6 text-natural-text text-sm">{item.date}</td>
                    <td className="px-10 py-6 text-natural-text font-medium italic">"{item.description}"</td>
                    <td className="px-10 py-6 text-natural-primary font-mono font-bold text-right text-lg">Rp {item.amount.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      {isAdmin && report.status === ReportStatus.BUDGET_PROPOSAL && (
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-natural-primary p-12 rounded-[40px] text-white shadow-2xl"
        >
          <div className="mb-8">
            <h3 className="text-3xl font-serif italic mb-2">Review Bendahara Utama</h3>
            <p className="text-white/60 text-xs uppercase tracking-widest font-bold">Verifikasi kebenaran dan kesesuaian dana</p>
          </div>
          
          <textarea 
            className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-white placeholder-white/30 focus:ring-2 focus:ring-natural-secondary outline-none mb-8 min-h-[160px] italic"
            placeholder="Tambahkan evaluasi atau catatan revisi untuk unit kerja..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex gap-6">
            <button 
              disabled={updating}
              onClick={() => handleUpdateStatusAction(ReportStatus.REJECTED)}
              className="flex-1 py-5 border border-white/20 hover:bg-red-600 hover:border-red-600 rounded-full font-bold uppercase text-xs tracking-widest transition-all disabled:opacity-50"
            >
              Tolak
            </button>
            <button 
              disabled={updating}
              onClick={() => handleUpdateStatusAction(ReportStatus.REVISION)}
              className="flex-1 py-5 border border-white/20 hover:bg-orange-600 hover:border-orange-600 rounded-full font-bold uppercase text-xs tracking-widest transition-all disabled:opacity-50"
            >
              Minta Revisi
            </button>
            <button 
              disabled={updating}
              onClick={() => handleUpdateStatusAction(ReportStatus.BUDGET_APPROVED)}
              className="flex-1 py-5 bg-natural-secondary text-white rounded-full font-serif italic text-xl hover:bg-white hover:text-natural-primary transition-all shadow-xl shadow-black/10 disabled:opacity-50"
            >
              Setujui & Tandai Sah
            </button>
          </div>
        </motion.div>
      )}

      {report.treasurerNotes && (
        <div className="bg-natural-secondary/10 border-l-4 border-natural-secondary p-8 rounded-r-[32px] rounded-l-lg">
          <div className="flex items-center gap-3 mb-3">
            <AlertCircle className="w-5 h-5 text-natural-secondary" />
            <h4 className="font-bold text-natural-primary uppercase tracking-widest text-xs">Ulasan Bendahara</h4>
          </div>
          <p className="text-natural-text italic font-medium leading-relaxed">"{report.treasurerNotes}"</p>
        </div>
      )}
    </motion.div>
  );
};

const DashboardStats = ({ reports }: { reports: Report[] }) => {
  const proposal = reports.filter(r => r.status === ReportStatus.BUDGET_PROPOSAL || r.status === ReportStatus.REVISION).length;
  const approved = reports.filter(r => r.status === ReportStatus.BUDGET_APPROVED).length;
  const reporting = reports.filter(r => r.status === ReportStatus.REPORTING).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      <div className="bg-white p-6 rounded-[32px] border border-natural-border shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <Clock className="w-5 h-5 text-amber-500" />
          <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-widest italic">Pengajuan Anggaran</p>
        </div>
        <p className="text-3xl font-serif italic font-bold text-natural-primary">{proposal}</p>
      </div>
      <div className="bg-white p-6 rounded-[32px] border border-natural-border shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-widest italic">Anggaran Disetujui</p>
        </div>
        <p className="text-3xl font-serif italic font-bold text-natural-primary">{approved}</p>
      </div>
      <div className="bg-white p-6 rounded-[32px] border border-natural-border shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-5 h-5 text-blue-500" />
          <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-widest italic">Proses Pelaporan</p>
        </div>
        <p className="text-3xl font-serif italic font-bold text-natural-primary">{reporting}</p>
      </div>
    </div>
  );
};

const UserList = ({ onAdd }: { onAdd: () => void }) => {
  const [users, setUsers] = useState<DBUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'app_users'), limit(100));
        const snap = await getDocs(q);
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() as any } as DBUser)));
      } catch (err) {
        console.error("Error fetching users", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleDeleteUser = async (id: string, username: string) => {
    if (window.confirm(`Hapus akun ${username}?`)) {
      try {
        // @ts-ignore
        await deleteDoc(doc(db, 'app_users', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `app_users/${id}`);
      }
    }
  };

  return (
    <div className="bg-white rounded-[40px] border border-natural-border shadow-sm overflow-hidden">
      <div className="px-10 py-8 border-b border-natural-bg flex justify-between items-center">
        <div>
          <h3 className="font-serif italic text-2xl text-natural-primary">Daftar Akun Pengguna</h3>
          <p className="text-natural-secondary text-xs uppercase tracking-widest font-bold mt-1">Kelola akses sistem</p>
        </div>
        <button 
          onClick={onAdd}
          className="bg-natural-primary text-white px-6 py-3 rounded-full font-serif italic flex items-center gap-2 hover:bg-natural-primary/90 transition-all shadow-lg shadow-natural-primary/20"
        >
          <PlusCircle className="w-4 h-4" />
          Tambah Akun
        </button>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-20 text-center text-natural-secondary font-serif italic text-xl">Memuat data...</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-natural-bg/30">
                <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic">Unit Kerja</th>
                <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic">Username</th>
                <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic">Password</th>
                <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic">Role</th>
                <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-natural-bg/50">
              {users.map((data) => (
                <tr key={data.id} className="hover:bg-natural-input transition-colors group">
                  <td className="px-10 py-6 text-natural-primary font-bold">{data.displayName}</td>
                  <td className="px-10 py-6 text-natural-text font-mono">{data.username}</td>
                  <td className="px-10 py-6 text-natural-text font-mono">{data.pass}</td>
                  <td className="px-10 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${data.role === 'admin' ? 'bg-natural-primary text-white' : 'bg-natural-secondary/20 text-natural-secondary'}`}>
                      {data.role}
                    </span>
                  </td>
                  <td className="px-10 py-6">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        data.id && handleDeleteUser(data.id, data.username);
                      }}
                      title="Hapus Akun"
                      className="opacity-40 hover:opacity-100 p-2 text-red-500 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const UserForm = ({ onCancel, initialUnitName }: { onCancel: () => void, initialUnitName?: string }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    pass: '',
    displayName: initialUnitName || '',
    unitName: initialUnitName || '',
    role: 'user' as 'admin' | 'user'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Add to users
      await addDoc(collection(db, 'app_users'), formData);
      
      // Sync to units collection
      const unitsSnap = await getDocs(query(collection(db, 'units'), where('name', '==', formData.unitName)));
      if (unitsSnap.empty) {
        await addDoc(collection(db, 'units'), { name: formData.unitName });
      }
      
      onCancel();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'app_users');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto">
      <div className="flex items-center gap-6 mb-10">
        <button onClick={onCancel} className="p-3 hover:bg-white rounded-full transition-colors border border-natural-border bg-white">
          <ArrowLeft className="w-5 h-5 text-natural-primary" />
        </button>
        <h2 className="text-3xl font-serif italic text-natural-primary tracking-tight">Registrasi Akun Baru</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[40px] border border-natural-border shadow-sm space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-natural-secondary tracking-widest">Username</label>
            <input required className="w-full p-4 bg-natural-input border-b border-natural-border focus:border-natural-primary outline-none" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value.toLowerCase()})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-natural-secondary tracking-widest">Password</label>
            <input required className="w-full p-4 bg-natural-input border-b border-natural-border focus:border-natural-primary outline-none" value={formData.pass} onChange={e => setFormData({...formData, pass: e.target.value})} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-natural-secondary tracking-widest">Nama Tampilan (e.g. Bendahara Utama)</label>
          <input required className="w-full p-3 bg-natural-input border-b border-natural-border focus:border-natural-primary outline-none" value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-natural-secondary tracking-widest">Unit Kerja</label>
            <input required className="w-full p-3 bg-natural-input border-b border-natural-border focus:border-natural-primary outline-none" value={formData.unitName} onChange={e => setFormData({...formData, unitName: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-natural-secondary tracking-widest">Role</label>
            <select className="w-full p-3 bg-natural-input border-b border-natural-border focus:border-natural-primary outline-none" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as 'admin' | 'user'})}>
              <option value="user">Unit Kerja</option>
              <option value="admin">Bendahara (Admin)</option>
            </select>
          </div>
        </div>

        <button disabled={loading} type="submit" className="w-full py-4 bg-natural-primary text-white rounded-full font-serif italic text-xl shadow-lg shadow-natural-primary/20 hover:bg-natural-primary/90 transition-all">
          {loading ? 'Menyimpan...' : 'Simpan Akun'}
        </button>
      </form>
    </motion.div>
  );
};



const ExpenseSettings = ({ types }: { types: ExpenseType[] }) => {
  const [newName, setNewName] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    try {
      await addDoc(collection(db, 'expense_types'), { name: newName });
      setNewName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'expense_types');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Hapus kategori pengeluaran ini?')) {
      try {
        await deleteDoc(doc(db, 'expense_types', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `expense_types/${id}`);
      }
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div className="bg-white p-10 rounded-[40px] border border-natural-border shadow-sm">
        <h3 className="text-2xl font-serif italic text-natural-primary mb-6">Pengaturan Jenis Pengeluaran</h3>
        <form onSubmit={handleAdd} className="flex gap-4">
          <input 
            className="flex-1 p-4 bg-natural-input border-b border-natural-border focus:border-natural-primary outline-none" 
            placeholder="Tambah jenis baru (e.g. Alat Tulis, Transport)..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <button type="submit" className="bg-natural-primary text-white px-8 py-4 rounded-full font-serif italic hover:bg-natural-primary/90 transition-all">
            Simpan
          </button>
        </form>
      </div>

      <div className="bg-white rounded-[40px] border border-natural-border shadow-sm overflow-hidden">
        <div className="px-10 py-6 bg-natural-bg/30 border-b border-natural-bg">
          <p className="text-[10px] uppercase font-bold text-natural-secondary tracking-widest">Kategori Aktif</p>
        </div>
        <div className="divide-y divide-natural-bg">
          {types.length === 0 ? (
            <div className="p-10 text-center text-natural-secondary italic">Belum ada kategori pengeluaran.</div>
          ) : (
            types.map(t => (
              <div key={t.id} className="px-10 py-4 flex justify-between items-center group hover:bg-natural-input transition-all">
                <span className="font-medium text-natural-primary">{t.name}</span>
                <button 
                  onClick={() => t.id && handleDelete(t.id)}
                  className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const EmployeeSettings = ({ employees, units }: { employees: Employee[], units: Unit[] }) => {
  const [formData, setFormData] = useState({ name: '' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    try {
      await addDoc(collection(db, 'employees'), formData);
      setFormData({ name: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'employees');
    }
  };

  const handleDelete = async (id: string) => {
    if (id && window.confirm('Hapus pegawai ini dari daftar?')) {
      try {
        await deleteDoc(doc(db, 'employees', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `employees/${id}`);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="bg-white p-10 rounded-[40px] border border-natural-border shadow-sm">
        <h3 className="text-2xl font-serif italic text-natural-primary mb-6">Kelola Daftar Pegawai</h3>
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 space-y-1.5 focus-within:text-natural-primary">
            <label className="text-[9px] uppercase font-bold text-natural-secondary/60 ml-2">Nama Lengkap Pegawai</label>
            <input 
              required
              className="w-full p-4 bg-natural-input border-b border-natural-border focus:border-natural-primary outline-none text-sm font-bold" 
              placeholder="E.g. Budi Santoso..."
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <button type="submit" className="md:self-end bg-natural-primary text-white py-4 px-8 rounded-full font-serif italic text-xl hover:bg-natural-primary/90 transition-all shadow-lg active:scale-95">
            Tambah Baru
          </button>
        </form>
      </div>

      <div className="bg-white rounded-[40px] border border-natural-border shadow-sm overflow-hidden">
        <div className="px-10 py-6 bg-natural-bg/30 border-b border-natural-bg">
          <p className="text-[10px] uppercase font-bold text-natural-secondary tracking-widest">Daftar Pegawai Aktif</p>
        </div>
        <div className="divide-y divide-natural-bg max-h-96 overflow-y-auto">
          {employees.length === 0 ? (
            <div className="p-10 text-center text-natural-secondary italic">Belum ada data pegawai.</div>
          ) : (
            employees.map(emp => (
              <div key={emp.id} className="px-10 py-4 flex justify-between items-center group hover:bg-natural-input transition-all">
                <div className="flex flex-col">
                  <span className="font-bold text-natural-primary">{emp.name}</span>
                </div>
                <button 
                  onClick={() => emp.id && handleDelete(emp.id)}
                  className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const MainDashboard = () => {
  const { user, isAdmin, logout } = useContext(AuthContext);
  const [reports, setReports] = useState<Report[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'detail' | 'create' | 'users' | 'add_user' | 'expense_settings' | 'employee_settings' | 'anggaran' | 'laporan' | 'arsip'>('dashboard');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [initialUnitNameForAccount, setInitialUnitNameForAccount] = useState('');

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setErrorInfo(null);

    // Listen to units
    const unsubUnits = onSnapshot(collection(db, 'units'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Unit));
      setUnits(data);
    }, (err) => console.error("Units listener failed", err));

    // Listen to expense types
    const unsubExp = onSnapshot(collection(db, 'expense_types'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() as any } as ExpenseType));
      setExpenseTypes(data);
    }, (err) => console.error("Expense types listener failed", err));

    // Listen to employees
    const unsubEmp = onSnapshot(collection(db, 'employees'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Employee));
      setEmployees(data);
    }, (err) => console.error("Employees listener failed", err));

    // Listen to reports
    const q = isAdmin
      ? query(collection(db, 'reports'), orderBy('submittedAt', 'desc'), limit(100))
      : query(collection(db, 'reports'), where('unitName', '==', user.unitName), orderBy('submittedAt', 'desc'), limit(100));

    const unsubReports = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Report));
      setReports(data);
      setLoading(false);
    }, (err: any) => {
      console.error("Reports listener failed", err);
      if (err.message?.includes('Quota exceeded') || err.message?.includes('Quota limit exceeded')) {
        setErrorInfo('Limit kuota harian database tercapai.');
      }
      setLoading(false);
    });

    return () => {
      unsubUnits();
      unsubExp();
      unsubEmp();
      unsubReports();
    };
  }, [user, isAdmin]);

  const refreshReports = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let q;
      if (isAdmin) {
        q = query(collection(db, 'reports'), orderBy('submittedAt', 'desc'), limit(50));
      } else {
        q = query(collection(db, 'reports'), where('unitName', '==', user.unitName), orderBy('submittedAt', 'desc'), limit(50));
      }
      const snap = await getDocs(q);
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Report)));
    } catch (err: any) {
      if (err.message?.includes('Quota exceeded') || err.message?.includes('Quota limit exceeded')) {
        setErrorInfo('Limit kuota harian database telah tercapai.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrintAnggaran = (report: Report) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Anggaran - ${report.activityName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;700&display=swap');
            body { font-family: 'Crimson Pro', serif; padding: 1cm; line-height: 1.4; color: #000; font-size: 11pt; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
            .meta { margin-bottom: 20px; }
            .meta td { padding: 4px 0; font-weight: bold; }
          </style>
        </head>
        <body>
          <div style="text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 20px;">
            <h1 style="margin: 2px 0 4px 0; font-size: 18pt; font-family: 'Crimson Pro', serif; font-weight: bold; letter-spacing: 1px;">SMK MUHAMMADIYAH 1 NGADIREJO</h1>
            <p style="margin: 0; font-size: 9pt; font-style: italic; color: #333;">Alamat: Jl. Raya Candiroto, Ngaren, Ngadirejo, Temanggung</p>
          </div>
          <div style="text-align: center; margin-bottom: 25px;">
            <h2 style="margin: 0; font-size: 14pt; text-transform: uppercase; text-decoration: underline;">Permohonan Anggaran Kegiatan (RAB)</h2>
          </div>
          <div class="meta">
            <table>
              <tr><td>Nama Kegiatan</td><td>: ${report.activityName}</td></tr>
              <tr><td>Unit Kerja</td><td>: ${report.unitName}</td></tr>
              <tr><td>Status RAB</td><td>: 
                <span style="font-weight: bold; color: ${report.status !== 'budget_proposal' && report.status !== 'rejected' ? '#15803d' : report.status === 'rejected' ? '#b91c1c' : '#b45309'}; border: 1px solid ${report.status !== 'budget_proposal' && report.status !== 'rejected' ? '#bbf7d0' : report.status === 'rejected' ? '#fca5a5' : '#fef3c7'}; background: ${report.status !== 'budget_proposal' && report.status !== 'rejected' ? '#f0fdf4' : report.status === 'rejected' ? '#fef2f2' : '#fffbeb'}; padding: 3px 8px; border-radius: 4px; font-size: 10pt; text-transform: uppercase;">
                  ${
                    report.status === 'budget_proposal' ? 'SEMENTARA (PROSES PENGAJUAN)' :
                    report.status === 'rejected' ? '❌ DITOLAK' : '✔ TELAH DISETUJUI / DISAHKAN OLEH BENDAHARA'
                  }
                </span>
              </td></tr>
            </table>
          </div>
          <div style="margin-bottom: 20px;">
             <p style="margin: 0; font-weight: bold;">Tanggal Pengajuan: ${report.submissionDate ? new Date(report.submissionDate).toLocaleDateString('id-ID', { dateStyle: 'long' }) : '-'}</p>
          </div>
          <table class="rpt-table" style="width:100%; border-collapse:collapse; margin-top:20px;">
            <thead>
                <tr style="background:#f0f0f0;">
                    <th style="border:1px solid #000; padding:6px;">Deskripsi</th>
                    <th style="border:1px solid #000; padding:6px; text-align:right;">Nominal (Rp)</th>
                </tr>
            </thead>
            <tbody>
                ${(report.proposedDetails || []).map(d => `
                    <tr>
                        <td style="border:1px solid #000; padding:6px;">${d.description}</td>
                        <td style="border:1px solid #000; padding:6px; text-align:right;">${d.amount.toLocaleString('id-ID')}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr>
                    <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:right;">Total</td>
                    <td style="border:1px solid #000; padding:6px; text-align:right; font-weight:bold;">${report.amountReceived.toLocaleString('id-ID')}</td>
                </tr>
            </tfoot>
          </table>
          <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 11pt;">
            <div style="text-align: center; width: 45%;">
              <p style="margin: 0 0 60px 0;">${report.ketuaJabatan || ''}</p>
              <p style="margin: 0; font-weight: bold; text-decoration: underline;">${report.ketuaName || ''}</p>
            </div>
            <div style="text-align: center; width: 45%;">
              <p style="margin: 0 0 60px 0;">${report.bendaharaJabatan || ''}</p>
              <p style="margin: 0; font-weight: bold; text-decoration: underline;">${report.bendaharaName || ''}</p>
            </div>
          </div>
          <div style="margin-top: 30px; display: flex; justify-content: center; font-size: 11pt; page-break-inside: avoid;">
            <div style="text-align: center; width: 45%;">
              <p style="margin: 0 0 60px 0; line-height: 1.4;">Mengetahui,<br/>Waka Ur........................</p>
              <div style="border-bottom: 1px solid #000; width: 220px; margin: 0 auto;"></div>
            </div>
          </div>
          <script>window.print(); setTimeout(() => window.close(), 1000);</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintLaporan = (report: Report) => {
    if (!isAdmin && report.status !== ReportStatus.COMPLETED && report.status !== ReportStatus.ARCHIVED) {
        alert("Laporan harus disahkan oleh bendahara terlebih dahulu.");
        return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Laporan - ${report.activityName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght=0,400;0,700;1,400&family=JetBrains+Mono:wght@400;700&display=swap');
            body { font-family: 'Crimson Pro', serif; padding: 1cm; font-size: 11pt; }
            .rpt-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; margin-top: 15px; }
            .rpt-table th, .rpt-table td { border: 1px solid #000; padding: 6px; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .meta-table { width: 100%; border: none; margin-bottom: 20px; }
            .meta-table td { padding: 4px; border: none; }
            .signature-block { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11pt; }
            .signature-box { text-align: center; width: 45%; }
            @media print {
              .page-break {
                page-break-before: always;
                display: block;
                clear: both;
              }
            }
          </style>
        </head>
        <body>
          <!-- PAGE 1: RINGKASAN ANGGARAN VS REALISASI -->
          <div style="text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 20px;">
            <h1 style="margin: 2px 0 4px 0; font-size: 18pt; font-family: 'Crimson Pro', serif; font-weight: bold; letter-spacing: 1px;">SMK MUHAMMADIYAH 1 NGADIREJO</h1>
            <p style="margin: 0; font-size: 9pt; font-style: italic; color: #333;">Alamat: Jl. Raya Candiroto, Ngaren, Ngadirejo, Temanggung</p>
          </div>

          <div class="text-center" style="margin-bottom: 30px;">
            <h2 style="margin: 0; text-transform: uppercase; font-size: 16pt; text-decoration: underline;">Laporan Realisasi Anggaran</h2>
            <h3 style="margin: 5px 0 0 0; font-weight: normal; font-size: 12pt; font-style: italic;">Ringkasan Pagu Anggaran vs Realisasi</h3>
          </div>

          <table class="meta-table">
            <tr>
              <td style="width: 20%; font-weight: bold;">Nama Kegiatan</td>
              <td style="width: 3%;">:</td>
              <td style="width: 77%; font-weight: bold;">${report.activityName}</td>
            </tr>
            <tr>
              <td>Unit Kerja</td>
              <td>:</td>
              <td>${report.unitName}</td>
            </tr>
            <tr>
              <td>Tanggal Pengajuan</td>
              <td>:</td>
              <td>${report.submissionDate ? new Date(report.submissionDate).toLocaleDateString('id-ID', { dateStyle: 'long' }) : '-'}</td>
            </tr>
            <tr>
              <td>Status Laporan</td>
              <td>:</td>
              <td>
                <span style="font-weight: bold; color: ${report.status === 'completed' || report.status === 'archived' ? '#15803d' : '#b45309'}; border: 1px solid ${report.status === 'completed' || report.status === 'archived' ? '#bbf7d0' : '#fef3c7'}; background: ${report.status === 'completed' || report.status === 'archived' ? '#f0fdf4' : '#fffbeb'}; padding: 3px 8px; border-radius: 4px; font-size: 10pt; text-transform: uppercase;">
                  ${report.status === 'completed' || report.status === 'archived' ? '✔ SUDAH DISETUJUI & DISAHKAN OLEH BENDAHARA' : 'PROSES PEMBUATAN LAPORAN (BELUM DISETUJUI)'}
                </span>
              </td>
            </tr>
          </table>

          <table class="rpt-table">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="width: 5%;">No</th>
                <th>Deskripsi Pagu Anggaran</th>
                <th style="width: 25%;">Anggaran (Rp)</th>
                <th style="width: 25%;">Realisasi (Rp)</th>
                <th style="width: 20%;">Selisih (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${(report.proposedDetails || []).map((p, pIdx) => {
                const actualAmount = (report.details || [])
                  .filter(d => d.proposedIndex === pIdx)
                  .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
                const diff = p.amount - actualAmount;
                return `
                  <tr>
                    <td class="text-center">${pIdx + 1}</td>
                    <td>${p.description}</td>
                    <td class="text-right">${p.amount.toLocaleString('id-ID')}</td>
                    <td class="text-right">${actualAmount.toLocaleString('id-ID')}</td>
                    <td class="text-right">${diff.toLocaleString('id-ID')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold; background: #fafafa;">
                <td colspan="2" class="text-right">TOTAL</td>
                <td class="text-right">${report.amountReceived.toLocaleString('id-ID')}</td>
                <td class="text-right">${report.totalSpent.toLocaleString('id-ID')}</td>
                <td class="text-right">${(report.amountReceived - report.totalSpent).toLocaleString('id-ID')}</td>
              </tr>
            </tfoot>
          </table>

          <div class="signature-block">
            <div class="signature-box">
              <p style="margin: 0 0 60px 0;">${report.ketuaJabatan || ''}</p>
              <p style="margin: 0; font-weight: bold; text-decoration: underline;">${report.ketuaName || ''}</p>
            </div>
            <div class="signature-box">
              <p style="margin: 0 0 60px 0;">${report.bendaharaJabatan || ''}</p>
              <p style="margin: 0; font-weight: bold; text-decoration: underline;">${report.bendaharaName || ''}</p>
            </div>
          </div>
          <div style="margin-top: 30px; display: flex; justify-content: center; font-size: 11pt; page-break-inside: avoid;">
            <div style="text-align: center; width: 45%;">
              <p style="margin: 0 0 60px 0; line-height: 1.4;">Mengetahui,<br/>Waka Ur........................</p>
              <div style="border-bottom: 1px solid #000; width: 220px; margin: 0 auto;"></div>
            </div>
          </div>

          <!-- PAGE 2: RINCIAN PENGGUNAAN ANGGARAN -->
          <div class="page-break"></div>

          <div style="text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 20px;">
            <h1 style="margin: 2px 0 4px 0; font-size: 18pt; font-family: 'Crimson Pro', serif; font-weight: bold; letter-spacing: 1px;">SMK MUHAMMADIYAH 1 NGADIREJO</h1>
            <p style="margin: 0; font-size: 9pt; font-style: italic; color: #333;">Alamat: Jl. Raya Candiroto, Ngaren, Ngadirejo, Temanggung</p>
          </div>

          <div class="text-center" style="margin-bottom: 30px;">
            <h2 style="margin: 0; text-transform: uppercase; font-size: 15pt; text-decoration: underline;">Rincian Penggunaan Anggaran Realisasi</h2>
            <h3 style="margin: 5px 0 0 0; font-weight: normal; font-size: 11pt; font-style: italic;">Rincian Pengeluaran Belanja Lengkap</h3>
          </div>

          <table class="meta-table">
            <tr>
              <td style="width: 20%; font-weight: bold;">Nama Kegiatan</td>
              <td style="width: 3%;">:</td>
              <td style="width: 77%; font-weight: bold;">${report.activityName}</td>
            </tr>
            <tr>
              <td>Unit Kerja</td>
              <td>:</td>
              <td>${report.unitName}</td>
            </tr>
            <tr>
              <td>Status Laporan</td>
              <td>:</td>
              <td>
                <span style="font-weight: bold; color: ${report.status === 'completed' || report.status === 'archived' ? '#15803d' : '#b45309'}; border: 1px solid ${report.status === 'completed' || report.status === 'archived' ? '#bbf7d0' : '#fef3c7'}; background: ${report.status === 'completed' || report.status === 'archived' ? '#f0fdf4' : '#fffbeb'}; padding: 3px 8px; border-radius: 4px; font-size: 10pt; text-transform: uppercase;">
                  ${report.status === 'completed' || report.status === 'archived' ? '✔ SUDAH DISETUJUI & DISAHKAN OLEH BENDAHARA' : 'PROSES PEMBUATAN LAPORAN (BELUM DISETUJUI)'}
                </span>
              </td>
            </tr>
          </table>

          <table class="rpt-table">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="width: 5%;">No</th>
                <th style="width: 15%;">Tanggal</th>
                <th style="width: 25%;">Pagu Anggaran Acuan</th>
                <th>Rincian Penggunaan Belanja</th>
                <th style="width: 15%;">Pagu (Rp)</th>
                <th style="width: 15%;">Realisasi (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${(report.details || []).map((d, index) => {
                const budgetItem = report.proposedDetails && d.proposedIndex !== undefined ? report.proposedDetails[d.proposedIndex] : null;
                const budgetDesc = budgetItem ? budgetItem.description : 'Tanpa Acuan';
                const budgetAmount = budgetItem ? budgetItem.amount.toLocaleString('id-ID') : '-';
                return `
                  <tr>
                    <td class="text-center">${index + 1}</td>
                    <td>${d.date ? new Date(d.date).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-'}</td>
                    <td>${budgetDesc}</td>
                    <td>${d.description}</td>
                    <td class="text-right">${budgetAmount}</td>
                    <td class="text-right">${d.amount.toLocaleString('id-ID')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold; background: #fafafa;">
                <td colspan="4" class="text-right">TOTAL PENGELUARAN</td>
                <td class="text-right">${report.amountReceived.toLocaleString('id-ID')}</td>
                <td class="text-right">${report.totalSpent.toLocaleString('id-ID')}</td>
              </tr>
            </tfoot>
          </table>

          <div class="signature-block">
            <div class="signature-box">
              <p style="margin: 0 0 60px 0;">${report.ketuaJabatan || ''}</p>
              <p style="margin: 0; font-weight: bold; text-decoration: underline;">${report.ketuaName || ''}</p>
            </div>
            <div class="signature-box">
              <p style="margin: 0 0 60px 0;">${report.bendaharaJabatan || ''}</p>
              <p style="margin: 0; font-weight: bold; text-decoration: underline;">${report.bendaharaName || ''}</p>
            </div>
          </div>
          <div style="margin-top: 30px; display: flex; justify-content: center; font-size: 11pt; page-break-inside: avoid;">
            <div style="text-align: center; width: 45%;">
              <p style="margin: 0 0 60px 0; line-height: 1.4;">Mengetahui,<br/>Waka Ur........................</p>
              <div style="border-bottom: 1px solid #000; width: 220px; margin: 0 auto;"></div>
            </div>
          </div>

          <script>window.print(); setTimeout(() => window.close(), 1000);</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleStatusUpdate = async (id: string, newStatus: ReportStatus, notes?: string) => {
    try {
      await setDoc(doc(db, 'reports', id), { 
        status: newStatus, 
        treasurerNotes: notes || '',
        updatedAt: serverTimestamp() 
      }, { merge: true });
      await refreshReports();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${id}`);
    }
  };

  const handleDeleteReport = async (report: Report) => {
    if (window.confirm(`Hapus kegiatan ${report.activityName}?`)) {
      try {
        await deleteDoc(doc(db, 'reports', report.id!));
        await refreshReports();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `reports/${report.id}`);
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-natural-bg font-sans selection:bg-natural-primary/10">
      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="w-80 bg-natural-bg border-r border-natural-border px-8 py-12 flex flex-col gap-10">
          <div className="space-y-1 px-4">
            <h1 className="text-2xl font-serif italic text-natural-primary tracking-tighter">E-Lapor.</h1>
            <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-[0.1em]">SMK MUH 1 NGADIREJO</p>
          </div>
          
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setView('dashboard')}
              className={`w-full text-left px-6 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${view === 'dashboard' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            <button 
              onClick={() => setView('anggaran')}
              className={`w-full text-left px-6 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${view === 'anggaran' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
            >
              <FileText className="w-4 h-4" />
              Anggaran
            </button>
            <button 
              onClick={() => setView('laporan')}
              className={`w-full text-left px-6 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${view === 'laporan' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
            >
              <FileText className="w-4 h-4" />
              Laporan
            </button>
            <button 
              onClick={() => setView('arsip')}
              className={`w-full text-left px-6 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${view === 'arsip' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
            >
              <Lock className="w-4 h-4" />
              Arsip Laporan
            </button>
            {isAdmin && (
              <>
                <div className="h-px bg-natural-border/50 my-4 mx-4" />
                <button 
                  onClick={() => setView('users')}
                  className={`w-full text-left px-6 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${view === 'users' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
                >
                  <Users className="w-4 h-4" />
                  Daftar Akun
                </button>

                <button 
                  onClick={() => setView('expense_settings')}
                  className={`w-full text-left px-6 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${view === 'expense_settings' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
                >
                  <Settings className="w-4 h-4" />
                  Jenis Pengeluaran
                </button>
                <button 
                  onClick={() => setView('employee_settings')}
                  className={`w-full text-left px-6 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${view === 'employee_settings' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
                >
                  <UserIcon className="w-4 h-4" />
                  Daftar Pegawai
                </button>
              </>
            )}
          </div>

          <div className="mt-auto pt-10 border-t border-natural-border px-4">
             <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-full bg-natural-primary/10 flex items-center justify-center text-natural-primary font-serif italic text-xl border border-natural-primary/20">
                  {user?.displayName?.[0] || 'U'}
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-natural-primary uppercase tracking-widest leading-none mb-1">{user?.displayName}</p>
                  <button onClick={logout} className="text-[9px] font-bold text-natural-secondary uppercase tracking-[0.2em] hover:text-red-500 transition-colors flex items-center gap-1">
                    Keluar Sistem <LogOut className="w-2 h-2" />
                  </button>
                </div>
             </div>
          </div>
        </div>

        <main className="flex-1 px-8 py-12">
          {errorInfo && (
            <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="font-medium">{errorInfo}</p>
            </div>
          )}
          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="mb-12 flex justify-between items-end">
                  <div>
                    <h2 className="text-4xl font-serif italic text-natural-primary tracking-tight">Ringkasan Sistem</h2>
                    <p className="text-natural-secondary text-sm uppercase tracking-widest font-light mt-2">Gambaran umum aktivitas keuangan sekolah</p>
                  </div>
                  <button 
                    onClick={refreshReports}
                    disabled={loading}
                    className="p-3 bg-natural-input border border-natural-border rounded-full hover:bg-white transition-all disabled:opacity-50"
                  >
                    <RotateCw className={`w-5 h-5 text-natural-secondary ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <DashboardStats reports={reports} />
                <div className="bg-white p-10 rounded-[40px] border border-natural-border shadow-sm">
                   <h3 className="font-serif italic text-2xl text-natural-primary mb-6">Informasi Hari Ini</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <p className="text-natural-text italic leading-relaxed text-sm">
                          Selamat datang di E-Lapor SMK MUH 1 NGADIREJO. {isAdmin ? 'Pantau alokasi dana dan verifikasi setiap SPJ dari unit kerja secara real-time.' : `Halo ${user?.displayName}, silakan lengkapi laporan rincian pengeluaran untuk anggaran yang telah diberikan oleh Bendahara.`}
                        </p>
                        <div className="flex gap-4">
                           <button 
                            onClick={() => setView('create')}
                            className="text-[10px] font-bold uppercase tracking-widest text-natural-primary bg-natural-primary/5 px-4 py-2 rounded-full border border-natural-primary/20 hover:bg-natural-primary hover:text-white transition-all"
                           >
                             {isAdmin ? 'Terbitkan Anggaran Baru' : 'Ajukan Anggaran Baru'}
                           </button>
                        </div>
                      </div>
                      <div className="flex flex-col justify-center gap-4 bg-natural-input p-6 rounded-3xl border border-natural-border/50">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-natural-secondary font-bold">Status Koneksi</span>
                          <span className="font-mono text-green-600 font-bold uppercase tracking-widest text-[9px]">Terhubung (Live)</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-natural-secondary font-bold">Laporan Pending</span>
                          <span className="font-mono font-bold text-amber-600">{reports.filter(r => r.status === ReportStatus.BUDGET_PROPOSAL || r.status === ReportStatus.REVISION).length} Kegiatan</span>
                        </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

            {view === 'anggaran' && (
              <motion.div key="anggaran" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                  <div>
                    <h2 className="text-4xl font-serif italic text-natural-primary tracking-tight">Anggaran</h2>
                    <p className="text-natural-secondary text-sm uppercase tracking-widest font-light mt-2">Daftar usulan kegiatan</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={refreshReports}
                      disabled={loading}
                      className="p-3 bg-natural-input border border-natural-border rounded-full hover:bg-white transition-all disabled:opacity-50"
                    >
                      <RotateCw className={`w-5 h-5 text-natural-secondary ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {!isAdmin && (
                      <button 
                        onClick={() => { setSelectedReport(null); setView('create'); }}
                        className="bg-natural-primary text-white px-6 py-3 rounded-full font-serif italic flex items-center gap-2 hover:bg-natural-primary/90 transition-all shadow-lg"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Tambah Anggaran
                      </button>
                    )}
                  </div>
                </div>
                <ReportTable 
                  reports={reports} 
                  isAdmin={isAdmin} 
                  allowedStatuses={[ReportStatus.BUDGET_PROPOSAL, ReportStatus.BUDGET_APPROVED, ReportStatus.REJECTED, ReportStatus.REVISION]}
                  onSelect={(r) => { setSelectedReport(r); setView('detail'); }} 
                  onPrint={handlePrintAnggaran}
                  onDelete={handleDeleteReport}
                />
              </motion.div>
            )}

            {view === 'laporan' && (
              <motion.div key="laporan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                  <div>
                    <h2 className="text-4xl font-serif italic text-natural-primary tracking-tight">Laporan Realisasi</h2>
                    <p className="text-natural-secondary text-sm uppercase tracking-widest font-light mt-2">Daftar laporan pengeluaran</p>
                  </div>
                  <button 
                    onClick={refreshReports}
                    disabled={loading}
                    className="p-3 bg-natural-input border border-natural-border rounded-full hover:bg-white transition-all disabled:opacity-50"
                  >
                    <RotateCw className={`w-5 h-5 text-natural-secondary ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <ReportTable 
                  reports={reports} 
                  isAdmin={isAdmin} 
                  allowedStatuses={[ReportStatus.REPORTING, ReportStatus.COMPLETED, ReportStatus.REVISION]}
                  onSelect={(r) => { setSelectedReport(r); setView('detail'); }} 
                  onPrint={handlePrintLaporan}
                  onPrintRAB={handlePrintAnggaran}
                  onDelete={handleDeleteReport}
                />
              </motion.div>
            )}

            {view === 'arsip' && (
              <motion.div key="arsip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                  <div>
                    <h2 className="text-4xl font-serif italic text-natural-primary tracking-tight">Arsip Laporan</h2>
                    <p className="text-natural-secondary text-sm uppercase tracking-widest font-light mt-2">Kumpulan laporan yang sudah selesai</p>
                  </div>
                  <button 
                    onClick={refreshReports}
                    disabled={loading}
                    className="p-3 bg-natural-input border border-natural-border rounded-full hover:bg-white transition-all disabled:opacity-50"
                  >
                    <RotateCw className={`w-5 h-5 text-natural-secondary ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <ReportTable 
                  reports={reports} 
                  isAdmin={isAdmin} 
                  allowedStatuses={[ReportStatus.COMPLETED, ReportStatus.ARCHIVED]}
                  onSelect={(r) => { setSelectedReport(r); setView('detail'); }} 
                  onPrint={handlePrintLaporan}
                  onPrintRAB={handlePrintAnggaran}
                  onDelete={handleDeleteReport}
                />
              </motion.div>
            )}

            {view === 'detail' && selectedReport && (
              <ReportDetail 
                report={selectedReport} 
                isAdmin={isAdmin}
                onPrint={() => {
                  if (selectedReport.status === ReportStatus.BUDGET_PROPOSAL || selectedReport.status === ReportStatus.BUDGET_APPROVED || selectedReport.status === ReportStatus.REJECTED) {
                    handlePrintAnggaran(selectedReport);
                  } else {
                    handlePrintLaporan(selectedReport);
                  }
                }}
                onPrintRAB={handlePrintAnggaran}
                onUpdateStatus={handleStatusUpdate}
                onBack={() => { setView('dashboard'); setSelectedReport(null); }}
                onEdit={() => setView('create')}
              />
            )}

            {view === 'create' && (
              <ReportForm 
                user={user!} 
                editReport={selectedReport || undefined}
                units={units}
                expenseTypes={expenseTypes}
                employees={employees}
                onPrintRAB={handlePrintAnggaran}
                onCancel={() => { setView('anggaran'); setSelectedReport(null); }} 
                onSuccess={() => { refreshReports(); setView('anggaran'); setSelectedReport(null); }} 
              />
            )}

            {view === 'users' && isAdmin && (
              <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <UserList onAdd={() => setView('add_user')} />
              </motion.div>
            )}

            {view === 'add_user' && isAdmin && (
              <UserForm 
                onCancel={() => { setView('users'); setInitialUnitNameForAccount(''); }} 
                initialUnitName={initialUnitNameForAccount}
              />
            )}



            {view === 'expense_settings' && isAdmin && (
              <motion.div key="expense_settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ExpenseSettings types={expenseTypes} />
              </motion.div>
            )}

            {view === 'employee_settings' && isAdmin && (
              <motion.div key="employee_settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <EmployeeSettings employees={employees} units={units} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <footer className="h-10 bg-[#f0eee4] px-8 flex items-center justify-between text-[10px] text-[#a5a58d] font-bold border-t border-natural-border italic">
        <span>SISTEM INFORMASI KEUANGAN MUHIJO • VER 2.0</span>
        <span>{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </footer>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const login = async (username: string, pass: string): Promise<boolean> => {
    try {
      const q = query(collection(db, 'app_users'), where('username', '==', username), where('pass', '==', pass));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const userData = snap.docs[0].data() as DBUser;
        const appUser: AppUser = {
          uid: snap.docs[0].id,
          username: userData.username,
          displayName: userData.displayName,
          unitName: userData.unitName
        };
        setUser(appUser);
        setIsAdmin(userData.role === 'admin');
        localStorage.setItem('auth_session', JSON.stringify(appUser));
        localStorage.setItem('user_role', userData.role);
        return true;
      }
    } catch (err: any) {
      console.error("Login failed", err);
      const msg = err.message || String(err);
      if (msg.includes('Quota exceeded') || msg.includes('Quota limit exceeded')) {
        setQuotaExceeded(true);
        setErrorMessage('Database sedang limit (Quota Exceeded). Tidak dapat memproses login saat ini.');
      }
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem('auth_session');
    localStorage.removeItem('user_role');
  };

  useEffect(() => {
    const session = localStorage.getItem('auth_session');
    const role = localStorage.getItem('user_role');
    if (session) {
      try {
        const u = JSON.parse(session) as AppUser;
        setUser(u);
        setIsAdmin(role === 'admin');
      } catch (err) {
        localStorage.removeItem('auth_session');
        localStorage.removeItem('user_role');
      }
    }
    setLoading(false);

    // Bootstrap units and users ONLY IF not done before in this browser
    const bootstrap = async () => {
      if (localStorage.getItem('db_bootstrapped_v2')) return;

      try {
        const usersSnap = await getDocs(query(collection(db, 'app_users'), limit(1)));
        if (usersSnap.empty) {
          for (const u of BOOTSTRAP_USERS) {
            await addDoc(collection(db, 'app_users'), u);
          }
        }

        const unitsSnap = await getDocs(query(collection(db, 'units'), limit(1)));
        if (unitsSnap.empty) {
          // If we derived units from BOOTSTRAP_USERS, we can skip one read here
          const defaultUnits = Array.from(new Set(BOOTSTRAP_USERS.map(u => u.unitName)));
          for (const name of defaultUnits) {
            await addDoc(collection(db, 'units'), { name });
          }
        }
        localStorage.setItem('db_bootstrapped_v2', 'true');
      } catch (e: any) {
        console.error("Bootstrap failed", e);
        const errorMessage = e.message || String(e);
        if (errorMessage.includes('Quota exceeded') || errorMessage.includes('Quota limit exceeded')) {
          setQuotaExceeded(true);
          try {
            const parsed = JSON.parse(errorMessage);
            setErrorMessage(parsed.error || errorMessage);
          } catch {
            setErrorMessage('Limit kuota harian database telah tercapai. Mohon coba lagi besok.');
          }
        }
      }
    };
    bootstrap();
  }, []);

  const contextValue = useMemo(() => ({ user, isAdmin, loading, login, logout }), [user, isAdmin, loading]);

  if (quotaExceeded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-natural-bg p-6">
        <div className="max-w-md w-full bg-white rounded-[40px] p-12 shadow-xl border border-red-100 text-center">
          <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="text-red-500 w-10 h-10" />
          </div>
          <h2 className="text-2xl font-serif italic text-red-700 mb-4">Layanan Terhenti Sementara</h2>
          <div className="text-natural-secondary text-sm space-y-4 text-left bg-red-50/30 p-6 rounded-3xl border border-red-50">
             <p className="font-medium whitespace-pre-wrap">{errorMessage || 'Limit kuota harian database telah tercapai.'}</p>
             <p className="text-xs opacity-75">Ini adalah limit dari Google Firebase (Free Tier). Sistem akan pulih secara otomatis besok atau jika pemilik proyek mengaktifkan 'Billing' di konsol Firebase.</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-8 w-full bg-natural-primary text-white font-serif italic text-lg py-4 rounded-full transition-all active:scale-[0.98]"
          >
            Coba Segarkan Halaman
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <LoadingScreen />;

  return (
    <AuthContext.Provider value={contextValue}>
      {!user ? <LoginPage /> : <MainDashboard />}
    </AuthContext.Provider>
  );
}
