/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, createContext, useContext } from 'react';
import { auth, login, logout, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, serverTimestamp, addDoc, getDocs } from 'firebase/firestore';
import { Report, ReportStatus, Unit, OperationType } from './types.ts';
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
  Search,
  ArrowLeft,
  FileText,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Context ---
interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, isAdmin: false, loading: true });

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
              <p className="text-[10px] opacity-70 uppercase tracking-wider mt-1">{isAdmin ? 'Bendahara Utama' : 'Unit Kerja'}</p>
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

const LoginPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-natural-bg p-6">
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md w-full bg-white rounded-[40px] p-12 shadow-sm border border-natural-border text-center"
    >
      <div className="bg-natural-primary w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-natural-primary/10">
        <FileText className="text-white w-9 h-9" />
      </div>
      <h2 className="text-4xl font-serif italic text-natural-primary tracking-tight mb-2">E-Lapor Muhijo</h2>
      <p className="text-natural-secondary mb-10 text-sm uppercase tracking-widest font-light">Sistem Pelaporan Dana Unit Kerja</p>
      
      <button 
        onClick={login}
        className="w-full bg-natural-primary text-white font-bold py-4 px-6 rounded-full flex items-center justify-center gap-3 hover:bg-natural-primary/90 transition-all active:scale-[0.98] shadow-md shadow-natural-primary/20"
      >
        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 brightness-0 invert" referrerPolicy="no-referrer" />
        Masuk dengan Google
      </button>
      
      <p className="mt-10 text-[10px] text-natural-secondary uppercase tracking-widest font-bold">
        Khusus Staf internal sekolah
      </p>
    </motion.div>
  </div>
);

const ReportForm = ({ onCancel, onSuccess, user }: { onCancel: () => void, onSuccess: () => void, user: User }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    unitId: '',
    unitName: '',
    activityName: '',
    executionDate: new Date().toISOString().split('T')[0],
    amountReceived: 0,
    details: [{ description: '', amount: 0 }]
  });

  const [units, setUnits] = useState<Unit[]>([]);

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const snap = await getDocs(collection(db, 'units'));
        setUnits(snap.docs.map(d => ({ id: d.id, ...d.data() } as Unit)));
      } catch (err) {
        console.error("Error fetching units", err);
      }
    };
    fetchUnits();
  }, []);

  const addDetail = () => {
    setFormData({ ...formData, details: [...formData.details, { description: '', amount: 0 }] });
  };

  const removeDetail = (index: number) => {
    const newDetails = [...formData.details];
    newDetails.splice(index, 1);
    setFormData({ ...formData, details: newDetails });
  };

  const totalSpent = formData.details.reduce((sum, d) => sum + d.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unitId || !formData.activityName) return;

    setLoading(true);
    try {
      const selectedUnit = units.find(u => u.id === formData.unitId);
      const report: Report = {
        unitId: formData.unitId,
        unitName: selectedUnit?.name || 'Unknown',
        activityName: formData.activityName,
        executionDate: formData.executionDate,
        amountReceived: formData.amountReceived,
        totalSpent: totalSpent,
        details: formData.details,
        status: ReportStatus.PENDING,
        submittedAt: serverTimestamp(),
        submittedBy: user.uid,
      };

      await addDoc(collection(db, 'reports'), report as any);
      onSuccess();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'reports');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-3xl mx-auto py-10"
    >
      <div className="flex items-center gap-6 mb-10">
        <button onClick={onCancel} className="p-3 hover:bg-white rounded-full transition-colors border border-natural-border bg-white shadow-sm">
          <ArrowLeft className="w-5 h-5 text-natural-primary" />
        </button>
        <div>
          <h2 className="text-3xl font-serif italic text-natural-primary tracking-tight">Buat Laporan Baru</h2>
          <p className="text-natural-secondary text-xs uppercase tracking-widest font-bold mt-1">Lengkapi rincian penggunaan anggaran</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white p-10 rounded-[32px] border border-natural-border shadow-sm space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-natural-secondary font-bold">Unit Kerja Pelapor</label>
              <select 
                required
                className="w-full p-3 bg-natural-input border-b border-natural-secondary text-sm font-medium focus:bg-white transition-all outline-none"
                value={formData.unitId}
                onChange={(e) => setFormData({...formData, unitId: e.target.value})}
              >
                <option value="">Pilih Unit...</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-natural-secondary font-bold">Tanggal Kegiatan</label>
              <input 
                type="date"
                required
                className="w-full p-3 bg-natural-input border-b border-natural-secondary text-sm font-medium focus:bg-white outline-none"
                value={formData.executionDate}
                onChange={(e) => setFormData({...formData, executionDate: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-natural-secondary font-bold">Judul/Nama Kegiatan</label>
            <input 
              required
              className="w-full p-3 bg-natural-input border-b border-natural-secondary text-sm font-medium focus:bg-white outline-none"
              placeholder="Contoh: Pengadaan Alat Tulis Kantor..."
              value={formData.activityName}
              onChange={(e) => setFormData({...formData, activityName: e.target.value})}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-natural-secondary font-bold">Dana Diterima dari Bendahara</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-natural-secondary font-mono text-xs">Rp</span>
              <input 
                type="number"
                required
                className="w-full pl-10 p-3 bg-natural-input border-b border-natural-secondary text-lg font-mono font-bold text-natural-primary focus:bg-white outline-none"
                value={formData.amountReceived}
                onChange={(e) => setFormData({...formData, amountReceived: parseInt(e.target.value) || 0})}
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[32px] border border-natural-border shadow-sm space-y-8">
          <div className="flex justify-between items-center border-b border-natural-bg pb-4">
            <h3 className="font-serif italic text-xl text-natural-primary">Rincian Pertanggungjawaban</h3>
            <button 
              type="button"
              onClick={addDetail}
              className="px-4 py-1.5 bg-natural-bg text-[11px] uppercase font-bold text-natural-secondary rounded-full hover:bg-natural-secondary hover:text-white transition-all flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Baris Baru
            </button>
          </div>

          <div className="space-y-6">
            {formData.details.map((detail, idx) => (
              <div key={idx} className="flex gap-6 items-end">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-natural-secondary/50 tracking-widest italic">Deskripsi Item {idx + 1}</label>
                  <input 
                    required
                    className="w-full p-2 bg-natural-input border-b border-natural-border text-sm italic focus:border-natural-secondary outline-none transition-all"
                    placeholder="Contoh: Belanja Snack 50 bungkus..."
                    value={detail.description}
                    onChange={(e) => {
                      const newD = [...formData.details];
                      newD[idx].description = e.target.value;
                      setFormData({...formData, details: newD});
                    }}
                  />
                </div>
                <div className="w-48 space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-natural-secondary/50 tracking-widest italic text-right block">Nominal</label>
                  <input 
                    type="number"
                    required
                    className="w-full p-2 bg-natural-input border-b border-natural-border text-sm font-mono font-bold text-right focus:border-natural-secondary outline-none"
                    value={detail.amount}
                    onChange={(e) => {
                      const newD = [...formData.details];
                      newD[idx].amount = parseInt(e.target.value) || 0;
                      setFormData({...formData, details: newD});
                    }}
                  />
                </div>
                {formData.details.length > 1 && (
                  <button 
                    type="button"
                    onClick={() => removeDetail(idx)}
                    className="p-2 text-red-300 hover:text-red-500 transition-colors"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-natural-bg flex justify-between items-center bg-natural-bg/30 -mx-10 px-10 py-6 -mb-10 rounded-b-[32px]">
            <span className="text-natural-secondary font-bold uppercase tracking-[0.2em] text-[10px]">Grand Total Penggunaan</span>
            <span className="text-2xl font-serif italic font-bold text-natural-primary">Rp {totalSpent.toLocaleString('id-ID')}</span>
          </div>
        </div>

        <div className="flex gap-6 justify-end">
          <button 
            type="button"
            onClick={onCancel}
            className="px-10 py-3 rounded-full font-bold text-natural-secondary uppercase text-xs tracking-widest hover:bg-white transition-all"
          >
            Batal
          </button>
          <button 
            type="submit"
            disabled={loading}
            className="px-10 py-3 bg-natural-primary text-white rounded-full font-serif italic text-lg hover:bg-natural-primary/90 shadow-lg shadow-natural-primary/20 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {loading ? 'Mengirim...' : 'Kirim Laporan'}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

const ReportDetail = ({ report, onBack, isAdmin }: { report: Report, onBack: () => void, isAdmin: boolean }) => {
  const [notes, setNotes] = useState(report.treasurerNotes || '');
  const [updating, setUpdating] = useState(false);

  const handleUpdateStatus = async (status: ReportStatus) => {
    if (!report.id) return;
    setUpdating(true);
    try {
      await setDoc(doc(db, 'reports', report.id), { 
        status, 
        treasurerNotes: notes,
        updatedAt: serverTimestamp() 
      }, { merge: true });
      onBack();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${report.id}`);
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
        <StatusBadge status={report.status} />
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
              {report.details.map((item, idx) => (
                <tr key={idx} className="hover:bg-natural-input transition-colors">
                  <td className="px-10 py-6 font-mono text-xs text-natural-secondary">{String(idx + 1).padStart(2, '0')}</td>
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
              onClick={() => handleUpdateStatus(ReportStatus.REJECTED)}
              className="flex-1 py-5 border border-white/20 hover:bg-red-600 hover:border-red-600 rounded-full font-bold uppercase text-xs tracking-widest transition-all disabled:opacity-50"
            >
              Tolak Laporan
            </button>
            <button 
              disabled={updating}
              onClick={() => handleUpdateStatus(ReportStatus.APPROVED)}
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

const MainDashboard = () => {
  const { user, isAdmin } = useContext(AuthContext);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    if (!user) return;

    let q;
    if (isAdmin) {
      q = query(collection(db, 'reports'));
    } else {
      q = query(collection(db, 'reports'), where('submittedBy', '==', user.uid));
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

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-natural-bg">
      <Navbar onLogout={logout} />
      
      <main className="max-w-7xl mx-auto px-8 py-12">
        <AnimatePresence mode="wait">
          {view === 'list' && (
            <motion.div 
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                  <h2 className="text-4xl font-serif italic text-natural-primary tracking-tight">Arsip Aktivitas</h2>
                  <p className="text-natural-secondary text-sm uppercase tracking-widest font-light mt-2">
                    {isAdmin ? 'Verifikasi pertanggungjawaban unit kerja' : 'Riwayat penggunaan anggaran unit kerja anda'}
                  </p>
                </div>
                {!isAdmin && (
                  <button 
                    onClick={() => setView('create')}
                    className="bg-natural-primary text-white px-8 py-4 rounded-full font-serif italic text-lg hover:bg-natural-primary/90 transition-all flex items-center gap-2 shadow-xl shadow-natural-primary/20 active:scale-[0.98]"
                  >
                    <PlusCircle className="w-5 h-5 flex-shrink-0" />
                    Buat Laporan Baru
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
                      onClick={() => { setSelectedReport(report); setView('detail'); }}
                      className="bg-white p-8 rounded-[32px] border border-natural-border shadow-sm transition-all cursor-pointer flex flex-col h-full group"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <StatusBadge status={report.status} />
                        <span className="text-[10px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic">
                          {report.submittedAt?.toDate ? report.submittedAt.toDate().toLocaleDateString('id-ID') : 'Draft'}
                        </span>
                      </div>
                      <h3 className="text-xl font-serif italic text-natural-primary leading-tight mb-2 group-hover:text-natural-secondary transition-colors underline decoration-natural-border/50 underline-offset-4">{report.activityName}</h3>
                      <p className="text-[11px] font-bold text-natural-secondary uppercase tracking-widest">{report.unitName}</p>
                      
                      <div className="mt-8 pt-6 border-t border-natural-bg space-y-4">
                        <div className="flex justify-between items-end">
                          <span className="text-[10px] font-bold text-natural-secondary/40 uppercase tracking-widest">Total Dana</span>
                          <span className="font-mono font-bold text-natural-primary text-xl tracking-tight">Rp {report.totalSpent.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between items-center bg-natural-bg/30 p-2 rounded-full px-4 group-hover:bg-natural-primary group-hover:text-white transition-all">
                          <span className="text-[9px] font-bold uppercase tracking-[0.3em]">Buka Detail Laporan</span>
                          <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {view === 'create' && user && (
            <ReportForm 
              user={user} 
              onCancel={() => setView('list')} 
              onSuccess={() => setView('list')} 
            />
          )}

          {view === 'detail' && selectedReport && (
            <ReportDetail 
              report={selectedReport} 
              isAdmin={isAdmin}
              onBack={() => { setView('list'); setSelectedReport(null); }} 
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const adminDoc = await getDoc(doc(db, 'admins', u.uid));
        setIsAdmin(adminDoc.exists());
        
        // Auto-bootstrap common units if none exist (for demo purposes)
        const unitsSnap = await getDocs(collection(db, 'units'));
        if (unitsSnap.empty) {
          const defaultUnits = ['Perpustakaan', 'OSIS', 'UKS', 'Sarana Prasarana', 'Kesiswaan'];
          for (const name of defaultUnits) {
            await addDoc(collection(db, 'units'), { name });
          }
        }

        // Auto-bootstrap admin (the user who first logs in if no admins exist)
        const adminSnap = await getDocs(collection(db, 'admins'));
        if (adminSnap.empty) {
            await setDoc(doc(db, 'admins', u.uid), { email: u.email });
            setIsAdmin(true);
        }

      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading }}>
      {!user ? <LoginPage /> : <MainDashboard />}
    </AuthContext.Provider>
  );
}
