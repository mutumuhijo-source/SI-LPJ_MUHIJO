/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, createContext, useContext } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, serverTimestamp, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { Report, ReportStatus, Unit, OperationType, ExpenseType } from './types.ts';
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
  Settings
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
    [ReportStatus.PENDING]: { color: 'bg-[#fcf8e3] text-amber-700 border-amber-200', icon: Clock, label: 'Menunggu' },
    [ReportStatus.APPROVED]: { color: 'bg-[#ebf5e9] text-green-700 border-green-200', icon: CheckCircle2, label: 'Disetujui' },
    [ReportStatus.REJECTED]: { color: 'bg-[#fbeaea] text-red-700 border-red-200', icon: XCircle, label: 'Ditolak' },
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
          <h2 className="text-4xl font-serif italic text-natural-primary tracking-tight mb-2">E-Lapor Muhijo</h2>
          <p className="text-natural-secondary text-xs uppercase tracking-widest font-light">Sistem Pelaporan Dana Unit Kerja</p>
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

const ReportForm = ({ onCancel, onSuccess, user, editReport }: { onCancel: () => void, onSuccess: () => void, user: AppUser, editReport?: Report }) => {
  const isAdmin = localStorage.getItem('user_role') === 'admin';
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    unitId: editReport?.unitId || '',
    unitName: editReport?.unitName || '',
    activityName: editReport?.activityName || '',
    executionDate: editReport?.executionDate || new Date().toISOString().split('T')[0],
    amountReceived: editReport?.amountReceived || 0,
    details: editReport?.details || [{ date: new Date().toISOString().split('T')[0], description: '', amount: 0 }]
  });

  const [units, setUnits] = useState<Unit[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const snap = await getDocs(collection(db, 'units'));
        const unitData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Unit));
        setUnits(unitData);
        
        if (!editReport && !formData.unitId && !isAdmin) {
          const matched = unitData.find(u => u.name === user.unitName);
          if (matched) setFormData(prev => ({ ...prev, unitId: matched.id, unitName: matched.name }));
        }
      } catch (err) {
        console.error("Error fetching units", err);
      }
    };
    fetchUnits();

    const unsubscribeExpenses = onSnapshot(collection(db, 'expense_types'), (snap) => {
      setExpenseTypes(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseType)));
    });
    return () => unsubscribeExpenses();
  }, [user.unitName, editReport, isAdmin]);

  const addDetail = () => {
    setFormData({ ...formData, details: [...formData.details, { date: new Date().toISOString().split('T')[0], description: '', amount: 0 }] });
  };

  const removeDetail = (index: number) => {
    const newDetails = [...formData.details];
    newDetails.splice(index, 1);
    setFormData({ ...formData, details: newDetails });
  };

  const totalSpent = formData.details.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unitId || !formData.activityName) return;

    setLoading(true);
    try {
      const selectedUnit = units.find(u => u.id === formData.unitId);
      const payload = {
        unitId: formData.unitId,
        unitName: selectedUnit?.name || formData.unitName || 'Unknown',
        activityName: formData.activityName,
        executionDate: formData.executionDate,
        amountReceived: Number(formData.amountReceived),
        totalSpent: totalSpent,
        details: formData.details,
        status: editReport?.status || ReportStatus.PENDING,
        submittedAt: editReport?.submittedAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        submittedBy: editReport?.submittedBy || user.uid,
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
        <button onClick={onCancel} className="p-3 hover:bg-white rounded-full transition-colors border border-natural-border bg-white shadow-sm">
          <ArrowLeft className="w-5 h-5 text-natural-primary" />
        </button>
        <div>
          <h2 className="text-3xl font-serif italic text-natural-primary tracking-tight">
            {isAdmin ? (editReport ? 'Revisi Alokasi Anggaran' : 'Sediakan Pagu Anggaran Baru') : (editReport ? 'Lengkapi Rincian Pengeluaran' : 'Pelaporan Mandiri')}
          </h2>
          <p className="text-natural-secondary text-xs uppercase tracking-widest font-bold mt-1">
            {isAdmin ? 'Tetapkan pagu dana untuk unit kerja terkait' : 'Input item pengeluaran sesuai realisasi lapangan'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white p-10 rounded-[32px] border border-natural-border shadow-sm space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-1.5 focus-within:text-natural-primary transition-colors">
              <label className="text-[10px] uppercase tracking-wider font-bold">Unit Kerja Penerima Mandat</label>
              <select 
                required
                disabled={!isAdmin && !!editReport}
                className="w-full p-4 bg-natural-input border-b-2 border-natural-bg text-sm font-bold focus:bg-white focus:border-natural-primary transition-all outline-none disabled:opacity-60"
                value={formData.unitId}
                onChange={(e) => setFormData({...formData, unitId: e.target.value})}
              >
                <option value="">Pilih Unit...</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 focus-within:text-natural-primary transition-colors">
              <label className="text-[10px] uppercase tracking-wider font-bold">Rencana Tanggal Pelaksanaan</label>
              <input 
                type="date"
                required
                disabled={!isAdmin && !!editReport}
                className="w-full p-4 bg-natural-input border-b-2 border-natural-bg text-sm font-bold focus:bg-white focus:border-natural-primary outline-none disabled:opacity-60"
                value={formData.executionDate}
                onChange={(e) => setFormData({...formData, executionDate: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1.5 focus-within:text-natural-primary transition-colors">
            <label className="text-[10px] uppercase tracking-wider font-bold">Judul / Kode Kegiatan</label>
            <input 
              required
              disabled={!isAdmin && !!editReport}
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

        {(!isAdmin || (isAdmin && editReport && editReport.details.length > 0)) && (
          <div className="bg-white p-10 rounded-[32px] border border-natural-border shadow-sm space-y-8">
            <div className="flex justify-between items-center border-b border-natural-bg pb-6">
              <div>
                <h3 className="font-serif italic text-2xl text-natural-primary">Input Rincian Realisasi</h3>
                <p className="text-[10px] uppercase font-bold text-natural-secondary tracking-widest mt-1">Sertakan bukti tanggal dan deskripsi yang jelas</p>
              </div>
              {!isAdmin && (
                <button 
                  type="button"
                  onClick={addDetail}
                  className="px-6 py-2.5 bg-natural-primary text-white text-[11px] uppercase font-bold rounded-full hover:bg-natural-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-natural-primary/20"
                >
                  <PlusCircle className="w-4 h-4" />
                  Baris Baru
                </button>
              )}
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
                    <label className="text-[9px] uppercase font-bold text-natural-secondary/60">Kategori</label>
                    <select 
                      disabled={isAdmin}
                      className="w-full p-2 bg-white rounded-xl border border-natural-border outline-none text-xs font-bold disabled:bg-transparent"
                      onChange={(e) => {
                        const newD = [...formData.details];
                        const current = newD[idx].description;
                        newD[idx].description = `[${e.target.value}] ${current.replace(/^\[.*?\]\s*/, '')}`;
                        setFormData({...formData, details: newD});
                      }}
                    >
                      <option value="">Pilih...</option>
                      {expenseTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[9px] uppercase font-bold text-natural-secondary/60">Deskripsi Pengeluaran</label>
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
                  <div className="md:col-span-2 space-y-1">
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
                    {!isAdmin && formData.details.length > 1 && (
                      <button 
                        type="button"
                        onClick={() => removeDetail(idx)}
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
            {editReport ? 'Simpan Perubahan Laporan' : (isAdmin ? 'Terbitkan Mandat Anggaran' : 'Kirim Laporan Realisasi')}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

const ReportTable = ({ reports, isAdmin, onSelect, onPrint }: { reports: Report[], isAdmin: boolean, onSelect: (r: Report) => void, onPrint: (r: Report) => void }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {reports.length === 0 ? (
        <div className="col-span-full py-32 text-center bg-white rounded-[40px] border border-dashed border-natural-border shadow-inner">
          <div className="bg-natural-bg w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-natural-secondary/40" />
          </div>
          <p className="text-natural-secondary font-serif italic text-xl">Belum ada aktivitas pelaporan.</p>
        </div>
      ) : (
        reports.map(report => (
          <motion.div 
            key={report.id}
            whileHover={{ y: -6, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
            className="bg-white p-8 rounded-[32px] border border-natural-border shadow-sm transition-all cursor-pointer flex flex-col h-full group"
          >
            <div className="flex justify-between items-start mb-6">
              <StatusBadge status={report.status} />
              <div className="flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); onPrint(report); }}
                  className="p-2 bg-natural-bg hover:bg-natural-primary hover:text-white rounded-full transition-all text-natural-secondary"
                  title="Cetak SPJ"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic self-center">
                  {report.executionDate}
                </span>
              </div>
            </div>
            
            <div onClick={() => onSelect(report)} className="flex-1">
              <h3 className="text-xl font-serif italic text-natural-primary leading-tight mb-2 group-hover:text-natural-secondary transition-colors underline decoration-natural-border/50 underline-offset-4">{report.activityName}</h3>
              <p className="text-[11px] font-bold text-natural-secondary uppercase tracking-widest">{report.unitName}</p>
              
              <div className="mt-8 pt-6 border-t border-natural-bg space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-natural-secondary/40 uppercase tracking-widest block">Realisasi</span>
                    <span className="font-mono font-bold text-natural-primary text-xl tracking-tight">Rp {report.totalSpent.toLocaleString('id-ID')}</span>
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

const ReportDetail = ({ report, onBack, isAdmin, onEdit, onPrint, onUpdateStatus }: { report: Report, onBack: () => void, isAdmin: boolean, onEdit: () => void, onPrint: () => void, onUpdateStatus: (id: string, s: ReportStatus, n?: string) => Promise<void> }) => {
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
          <p className="text-natural-secondary text-sm uppercase tracking-[0.2em] font-light mt-1">{report.unitName} • {new Date(report.executionDate).toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
        </div>
        <div className="flex items-center gap-4">
           <button 
             onClick={onPrint}
             className="p-3 bg-white border border-natural-border text-natural-primary rounded-full hover:bg-natural-input transition-all shadow-sm flex items-center gap-2 px-6 font-bold uppercase text-[10px] tracking-widest"
           >
             <Printer className="w-4 h-4" />
             Cetak SPJ
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
            <h3 className="font-serif italic text-2xl text-natural-primary">Rincian Laporan</h3>
            <p className="text-natural-secondary text-xs uppercase tracking-widest font-bold mt-1">Itemized Expense Report</p>
          </div>
          {!isAdmin && report.status === ReportStatus.PENDING && (
            <button 
              onClick={onEdit}
              className="bg-natural-primary text-white px-6 py-2 rounded-full font-serif italic text-sm hover:bg-natural-primary/90 transition-all shadow-md"
            >
              Lengkapi / Edit Rincian
            </button>
          )}
        </div>
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

      {isAdmin && report.status === ReportStatus.PENDING && (
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
              Tolak Laporan
            </button>
            <button 
              disabled={updating}
              onClick={() => handleUpdateStatusAction(ReportStatus.APPROVED)}
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
  const pending = reports.filter(r => r.status === ReportStatus.PENDING).length;
  const approved = reports.filter(r => r.status === ReportStatus.APPROVED).length;
  const belumDilaporkan = reports.filter(r => r.status === ReportStatus.PENDING && r.totalSpent === 0).length;
  const totalDana = reports.reduce((sum, r) => sum + r.amountReceived, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
      <div className="bg-white p-6 rounded-[32px] border border-natural-border shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <Clock className="w-5 h-5 text-amber-500" />
          <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-widest italic">Menunggu Review</p>
        </div>
        <p className="text-3xl font-serif italic font-bold text-natural-primary">{pending}</p>
      </div>
      <div className="bg-white p-6 rounded-[32px] border border-natural-border shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-widest italic">Belum Dilaporkan</p>
        </div>
        <p className="text-3xl font-serif italic font-bold text-natural-primary">{belumDilaporkan}</p>
      </div>
      <div className="bg-white p-6 rounded-[32px] border border-natural-border shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-widest italic">Laporan Sah</p>
        </div>
        <p className="text-3xl font-serif italic font-bold text-natural-primary">{approved}</p>
      </div>
      <div className="bg-white p-6 rounded-[32px] border border-natural-border shadow-sm col-span-1 md:col-span-1">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-5 h-5 text-blue-500" />
          <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-widest italic">Total Anggaran</p>
        </div>
        <p className="text-xl font-mono font-bold text-natural-primary">Rp {totalDana.toLocaleString('id-ID')}</p>
      </div>
    </div>
  );
};

const UserList = ({ onAdd }: { onAdd: () => void }) => {
  const [users, setUsers] = useState<DBUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'app_users'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as DBUser)));
      setLoading(false);
    });
    return () => unsubscribe();
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

const UnitList = ({ onAddAccount }: { onAddAccount: (unitName: string) => void }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUnitName, setNewUnitName] = useState('');
  const [addingUnit, setAddingUnit] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'units'), (snap) => {
      setUnits(snap.docs.map(d => ({ id: d.id, ...d.data() } as Unit)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName) return;
    setAddingUnit(true);
    try {
      // Check if unit exists
      const existing = units.find(u => u.name.toLowerCase() === newUnitName.toLowerCase());
      if (existing) {
        alert('Unit sudah terdaftar');
        return;
      }

      await addDoc(collection(db, 'units'), { name: newUnitName });
      
      // Also trigger account creation
      if (window.confirm(`Unit ${newUnitName} berhasil ditambahkan. Apakah Anda ingin langsung membuat akun login untuk unit ini?`)) {
        onAddAccount(newUnitName);
      }
      
      setNewUnitName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'units');
    } finally {
      setAddingUnit(false);
    }
  };

  const handleDeleteUnit = async (id: string, name: string) => {
    if (window.confirm(`Hapus unit kerja ${name}? Ini hanya menghapus daftar pilihan, data laporan tidak akan terhapus.`)) {
      try {
        await deleteDoc(doc(db, 'units', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `units/${id}`);
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-10 rounded-[40px] border border-natural-border shadow-sm">
        <h3 className="font-serif italic text-2xl text-natural-primary mb-6">Tambah Unit Kerja Baru</h3>
        <form onSubmit={handleAddUnit} className="flex gap-4">
          <input 
            required
            className="flex-1 p-4 bg-natural-input border-b border-natural-border focus:border-natural-primary outline-none" 
            placeholder="Masukkan nama unit kerja (e.g. Unit Tata Usaha)..."
            value={newUnitName}
            onChange={e => setNewUnitName(e.target.value)}
          />
          <button 
            disabled={addingUnit}
            type="submit" 
            className="bg-natural-primary text-white px-8 py-4 rounded-full font-serif italic flex items-center gap-2 hover:bg-natural-primary/90 transition-all shadow-lg shadow-natural-primary/20"
          >
            {addingUnit ? 'Menyimpan...' : 'Tambah Unit'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-[40px] border border-natural-border shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-natural-bg">
          <h3 className="font-serif italic text-2xl text-natural-primary">Daftar Unit Kerja</h3>
          <p className="text-natural-secondary text-xs uppercase tracking-widest font-bold mt-1">Unit yang terdaftar di lingkungan sekolah</p>
        </div>
        <div className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-20 text-center text-natural-secondary font-serif italic">Memuat unit kerja...</div>
          ) : (
            units.map(unit => (
              <div key={unit.id} className="group p-6 bg-natural-bg border border-natural-border rounded-3xl flex items-center justify-between hover:border-natural-primary transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-natural-primary/10 rounded-full flex items-center justify-center text-natural-primary">
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <span className="font-serif italic text-lg text-natural-primary">{unit.name}</span>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    unit.id && handleDeleteUnit(unit.id, unit.name);
                  }}
                  title="Hapus Unit"
                  className="opacity-40 hover:opacity-100 p-2 text-red-500 hover:bg-red-50 rounded-full transition-all cursor-pointer"
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

const ExpenseSettings = () => {
  const [types, setTypes] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'expense_types'), (snap) => {
      setTypes(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseType)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
          {loading ? (
            <div className="p-10 text-center text-natural-secondary italic">Memuat...</div>
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

const MainDashboard = () => {
  const { user, isAdmin, logout } = useContext(AuthContext);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'list' | 'create' | 'detail' | 'users' | 'add_user' | 'units' | 'expense_settings'>('dashboard');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [initialUnitNameForAccount, setInitialUnitNameForAccount] = useState('');

  useEffect(() => {
    if (!user) return;

    let q;
    if (isAdmin) {
      q = query(collection(db, 'reports'));
    } else {
      q = query(collection(db, 'reports'), where('unitName', '==', user.unitName));
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Report));
      setReports(data.sort((a, b) => {
        const dateA = a.submittedAt?.seconds || 0;
        const dateB = b.submittedAt?.seconds || 0;
        return dateB - dateA;
      }));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'reports');
    });

    return () => unsubscribe();
  }, [user, isAdmin]);

  const handlePrint = (report: Report) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>SPJ - ${report.activityName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;700&display=swap');
            body { font-family: 'Crimson Pro', serif; padding: 1cm; line-height: 1.4; color: #000; font-size: 11pt; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 18pt; text-transform: uppercase; }
            .header p { margin: 2px 0; font-size: 10pt; }
            .title { text-align: center; font-weight: bold; text-decoration: underline; margin-bottom: 20px; font-size: 14pt; }
            .meta { margin-bottom: 20px; }
            .meta table { width: 100%; border-collapse: collapse; }
            .meta td { padding: 4px 0; vertical-align: top; }
            .meta td:first-child { width: 140px; font-weight: bold; }
            .rpt-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .rpt-table th, .rpt-table td { border: 1px solid #000; padding: 6px 10px; text-align: left; }
            .rpt-table th { background: #f0f0f0; text-transform: uppercase; font-size: 9pt; }
            .mono { font-family: 'JetBrains Mono', monospace; font-size: 9pt; }
            .text-right { text-align: right; }
            .summary { margin-top: 20px; page-break-inside: avoid; }
            .summary table { width: 100%; border-collapse: collapse; }
            .summary td { padding: 6px 10px; border: 1px solid #000; font-weight: bold; }
            .sign { margin-top: 40px; display: grid; grid-template-cols: 1fr 1fr; gap: 40px; page-break-inside: avoid; }
            .sign-box { text-align: center; }
            .sign-space { height: 60px; }
            @media print { .no-print { display: none; } button { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Laporan Pertanggungjawaban Dana (SPJ)</h1>
            <p>SD MUHAMMADIYAH 1 TLOGOMAS MALANG</p>
            <p>Jl. Karya Wiguna No. 250, Tlogomas, Kec. Lowokwaru, Kota Malang</p>
          </div>
          <div class="title">RINCIAN PENGGUNAAN ANGGARAN</div>
          <div class="meta">
            <table>
              <tr><td>Nama Kegiatan</td><td>: ${report.activityName}</td></tr>
              <tr><td>Unit Kerja</td><td>: ${report.unitName}</td></tr>
              <tr><td>Status Laporan</td><td>: ${report.status.toUpperCase()}</td></tr>
              <tr><td>Alokasi Dana</td><td>: <span class="mono">Rp ${report.amountReceived.toLocaleString('id-ID')}</span></td></tr>
            </table>
          </div>
          <table class="rpt-table">
            <thead>
              <tr>
                <th style="width: 30px;">No</th>
                <th style="width: 80px;">Tanggal</th>
                <th>Uraian Penggunaan</th>
                <th style="width: 120px;" class="text-right">Jumlah (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${report.details.map((d, i) => `
                <tr>
                  <td style="text-align: center;">${i + 1}</td>
                  <td>${d.date}</td>
                  <td>${d.description}</td>
                  <td class="text-right mono">${(d.amount || 0).toLocaleString('id-ID')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="summary">
            <table>
              <tr>
                <td style="width: 70%; text-align: right;">Total Dana Terealisasi</td>
                <td class="text-right mono">Rp ${report.totalSpent.toLocaleString('id-ID')}</td>
              </tr>
              <tr>
                <td style="width: 70%; text-align: right;">Sisa Dana Anggaran</td>
                <td class="text-right mono">Rp ${(report.amountReceived - report.totalSpent).toLocaleString('id-ID')}</td>
              </tr>
            </table>
          </div>
          <div class="sign">
            <div class="sign-box">
              <p>Mengetahui,</p>
              <p>Bendahara Sekolah</p>
              <div class="sign-space"></div>
              <p><b>( Bendahara Utama )</b></p>
            </div>
            <div class="sign-box">
              <p>Malang, ${new Date().toLocaleDateString('id-ID')}</p>
              <p>Hormat Kami,</p>
              <div class="sign-space"></div>
              <p><b>( ${report.unitName} )</b></p>
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
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${id}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-natural-bg font-sans selection:bg-natural-primary/10">
      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="w-80 bg-natural-bg border-r border-natural-border px-8 py-12 flex flex-col gap-10">
          <div className="space-y-1 px-4">
            <h1 className="text-3xl font-serif italic text-natural-primary tracking-tighter">E-Lapor.</h1>
            <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-[0.3em]">Muhijo Finance</p>
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
              onClick={() => setView('list')}
              className={`w-full text-left px-6 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${view === 'list' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
            >
              <FileText className="w-4 h-4" />
              Daftar Laporan
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
                  onClick={() => setView('units')}
                  className={`w-full text-left px-6 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${view === 'units' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Daftar Unit
                </button>
                <button 
                  onClick={() => setView('expense_settings')}
                  className={`w-full text-left px-6 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${view === 'expense_settings' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
                >
                  <Settings className="w-4 h-4" />
                  Jenis Pengeluaran
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
          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="mb-12">
                  <h2 className="text-4xl font-serif italic text-natural-primary tracking-tight">Ringkasan Sistem</h2>
                  <p className="text-natural-secondary text-sm uppercase tracking-widest font-light mt-2">Gambaran umum aktivitas keuangan sekolah</p>
                </div>
                <DashboardStats reports={reports} />
                <div className="bg-white p-10 rounded-[40px] border border-natural-border shadow-sm">
                   <h3 className="font-serif italic text-2xl text-natural-primary mb-6">Informasi Hari Ini</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <p className="text-natural-text italic leading-relaxed text-sm">
                          Selamat datang di E-Lapor Muhijo. {isAdmin ? 'Pantau alokasi dana dan verifikasi setiap SPJ dari unit kerja secara real-time.' : `Halo ${user?.displayName}, silakan lengkapi laporan rincian pengeluaran untuk anggaran yang telah diberikan oleh Bendahara.`}
                        </p>
                        <div className="flex gap-4">
                           <button 
                            onClick={() => isAdmin ? setView('create') : setView('list')}
                            className="text-[10px] font-bold uppercase tracking-widest text-natural-primary bg-natural-primary/5 px-4 py-2 rounded-full border border-natural-primary/20 hover:bg-natural-primary hover:text-white transition-all"
                           >
                             {isAdmin ? 'Terbitkan Anggaran Baru' : 'Lihat Daftar Pelaporan'}
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
                          <span className="font-mono font-bold text-amber-600">{reports.filter(r => r.status === ReportStatus.PENDING).length} Kegiatan</span>
                        </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

            {view === 'list' && (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                  <div>
                    <h2 className="text-4xl font-serif italic text-natural-primary tracking-tight">Arsip Aktivitas</h2>
                    <p className="text-natural-secondary text-sm uppercase tracking-widest font-light mt-2">
                       {isAdmin ? 'Verifikasi pertanggungjawaban unit kerja' : 'Daftar anggaran dan laporan realisasi unit anda'}
                    </p>
                  </div>
                  {!isAdmin && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3">
                       <AlertCircle className="w-5 h-5 text-amber-600" />
                       <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider leading-tight">
                         Lengkapi rincian pengeluaran<br/>pada anggaran bertanda pending
                       </p>
                    </div>
                  )}
                </div>
                <ReportTable 
                  reports={reports} 
                  isAdmin={isAdmin} 
                  onSelect={(r) => { setSelectedReport(r); setView('detail'); }} 
                  onPrint={handlePrint}
                />
              </motion.div>
            )}

            {view === 'detail' && selectedReport && (
              <ReportDetail 
                report={selectedReport} 
                isAdmin={isAdmin}
                onPrint={() => handlePrint(selectedReport)}
                onUpdateStatus={handleStatusUpdate}
                onBack={() => { setView('list'); setSelectedReport(null); }}
                onEdit={() => setView('create')}
              />
            )}

            {view === 'create' && (
              <ReportForm 
                user={user!} 
                editReport={selectedReport || undefined}
                onCancel={() => { setView('list'); setSelectedReport(null); }} 
                onSuccess={() => { setView('list'); setSelectedReport(null); }} 
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

            {view === 'units' && isAdmin && (
              <motion.div key="units" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <UnitList onAddAccount={(name) => { setInitialUnitNameForAccount(name); setView('add_user'); }} />
              </motion.div>
            )}

            {view === 'expense_settings' && isAdmin && (
              <motion.div key="expense_settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ExpenseSettings />
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
    } catch (err) {
      console.error("Login failed", err);
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

    // Bootstrap units and users
    const bootstrap = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'app_users'));
        if (usersSnap.empty) {
          for (const u of BOOTSTRAP_USERS) {
            await addDoc(collection(db, 'app_users'), u);
          }
        }

        const unitsSnap = await getDocs(collection(db, 'units'));
        if (unitsSnap.empty) {
          const currentUsers = await getDocs(collection(db, 'app_users'));
          const defaultUnits = Array.from(new Set(currentUsers.docs.map(d => (d.data() as DBUser).unitName)));
          for (const name of defaultUnits) {
            await addDoc(collection(db, 'units'), { name });
          }
        }
      } catch (e) {
        console.error("Bootstrap failed", e);
      }
    };
    bootstrap();
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, logout }}>
      {!user ? <LoginPage /> : <MainDashboard />}
    </AuthContext.Provider>
  );
}
