/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, createContext, useContext, useMemo, useCallback, Component, ReactNode, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, Navigate, useLocation, useParams } from 'react-router-dom';
import { db } from './firebase';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, serverTimestamp, addDoc, getDocs, deleteDoc, limit, orderBy } from 'firebase/firestore';
import { Report, ReportStatus, Unit, OperationType, ExpenseType, ExpenseDetail, Employee, SchoolSettings } from './types';
import { handleFirestoreError } from './lib/error-handler';
import { 
  LayoutDashboard, 
  PlusCircle, 
  LogOut, 
  ChevronRight, 
  CircleCheck, 
  CircleX, 
  Clock, 
  User as UserIcon,
  Users,
  Search,
  ArrowLeft,
  FileText,
  AlertCircle,
  Lock,
  CircleUserRound,
  Trash2,
  Printer,
  Settings,
  RotateCw,
  Folder,
  Calendar,
  Palette,
  Check,
  BookOpen,
  Undo2,
  MessageSquare,
  Smartphone,
  Send,
  CheckCircle2,
  ShieldCheck,
  KeyRound,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Building2,
  FileCheck2,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BukuKasKeluar } from './components/BukuKasKeluar';
import { WhatsAppSettings } from './components/WhatsAppSettings';
import { SettingsPage } from './components/SettingsPage';
import { MemoBudgetPage } from './components/MemoBudgetPage';
import { MemorialKasTunaiPage } from './components/MemorialKasTunaiPage';
import { sendReportStatusNotification, sendWhatsappVerificationCode } from './services/whatsapp';
import { formatCurrency, parseAmount, terbilang } from './lib/utils';

// Safe alert and confirm helper functions for sandboxed/iframe compliance
const safeAlert = (message: string) => {
  try {
    window.alert(message);
  } catch (e) {
    console.warn("window.alert blocked or failed inside iframe sandbox:", e);
  }
};

const safeConfirm = (message: string): boolean => {
  try {
    return window.confirm(message);
  } catch (e) {
    console.warn("window.confirm blocked or failed inside iframe sandbox:", e);
    return true; // Return true as fallback to prevent blocking crucial operations in test runners
  }
};

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

// --- Themes ---
export interface ThemeOption {
  id: string;
  name: string;
  desc: string;
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'emerald',
    name: 'Hijau Zamrud',
    desc: 'Nuansa Islami & Keuangan Sekolah yang sejuk & resmi',
    primaryColor: '#064e3b',
    secondaryColor: '#047857',
    bgColor: '#f2f7f4',
  },
  {
    id: 'navy',
    name: 'Biru Eksekutif',
    desc: 'Klasik administrasi formal & profesional',
    primaryColor: '#0f3a5f',
    secondaryColor: '#334e68',
    bgColor: '#f0f4f8',
  },
  {
    id: 'indigo',
    name: 'Royal Indigo',
    desc: 'Modern berkelas, prestisius & elegan',
    primaryColor: '#1e1b4b',
    secondaryColor: '#4338ca',
    bgColor: '#f5f7fb',
  },
  {
    id: 'teal',
    name: 'Toska Segar',
    desc: 'Teal cerah, bersih & kontras tinggi',
    primaryColor: '#115e59',
    secondaryColor: '#0d9488',
    bgColor: '#f0fdfa',
  },
  {
    id: 'slate',
    name: 'Slate Minimalis',
    desc: 'Monokrom netral, bersih & modern',
    primaryColor: '#0f172a',
    secondaryColor: '#475569',
    bgColor: '#f8fafc',
  },
  {
    id: 'maroon',
    name: 'Marun Prestisius',
    desc: 'Anggun, hangat & berkarakter tegas',
    primaryColor: '#831843',
    secondaryColor: '#be185d',
    bgColor: '#fdf2f4',
  },
];

interface ThemeContextType {
  theme: string;
  setTheme: (t: string) => void;
  themes: ThemeOption[];
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'emerald',
  setTheme: () => {},
  themes: THEME_OPTIONS,
});

export const useTheme = () => useContext(ThemeContext);

const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<string>(() => {
    return safeLocalStorage.getItem('app_theme') || 'emerald';
  });

  const setTheme = useCallback((newTheme: string) => {
    setThemeState(newTheme);
    safeLocalStorage.setItem('app_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    setTheme,
    themes: THEME_OPTIONS
  }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

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

// --- Error Boundary ---

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-natural-bg p-6">
          <div className="max-w-md w-full bg-white rounded-[40px] p-12 shadow-xl border border-natural-border text-center">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-red-600 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-serif italic text-red-600 mb-4">Terjadi Kesalahan Sistem</h2>
            <p className="text-natural-secondary text-sm mb-6">Kami memohon maaf, aplikasi mengalami kendala teknis yang tidak terduga.</p>
            <div className="text-left mb-6">
              <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-widest mb-2">Detail Galat:</p>
              <pre className="text-[10px] bg-natural-input p-4 rounded-2xl overflow-auto border border-natural-border/50 max-h-40 font-mono">
                {this.state.error?.message || 'Script Error / Runtime Exception'}
              </pre>
            </div>
            <button 
              onClick={() => window.location.assign('/')}
              className="w-full bg-natural-primary text-white py-4 rounded-full font-serif italic text-lg shadow-lg shadow-natural-primary/20"
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Helper Utilities ---

const safeLocalStorage = (() => {
  try {
    const testKey = '__test_local__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (e) {
    const mem: Record<string, string> = {};
    return {
      getItem: (key: string) => (key in mem ? mem[key] : null),
      setItem: (key: string, value: string) => { mem[key] = String(value); },
      removeItem: (key: string) => { delete mem[key]; },
      clear: () => { for (const k in mem) delete mem[k]; },
      key: (i: number) => Object.keys(mem)[i] || null,
      get length() { return Object.keys(mem).length; }
    } as any;
  }
})();

const safeSessionStorage = (() => {
  try {
    const testKey = '__test_session__';
    window.sessionStorage.setItem(testKey, testKey);
    window.sessionStorage.removeItem(testKey);
    return window.sessionStorage;
  } catch (e) {
    const mem: Record<string, string> = {};
    return {
      getItem: (key: string) => (key in mem ? mem[key] : null),
      setItem: (key: string, value: string) => { mem[key] = String(value); },
      removeItem: (key: string) => { delete mem[key]; },
      clear: () => { for (const k in mem) delete mem[k]; },
      key: (i: number) => Object.keys(mem)[i] || null,
      get length() { return Object.keys(mem).length; }
    } as any;
  }
})();

// Alias safeStorage to safeLocalStorage for reliable data persistence
const safeStorage = safeLocalStorage;

const formatDate = (dateValue: string | number | Date | undefined | null, options: Intl.DateTimeFormatOptions = { dateStyle: 'long' }) => {
  if (!dateValue) return '-';
  try {
    const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(d.getTime())) return String(dateValue);
    return d.toLocaleDateString('id-ID', options);
  } catch (e) {
    return String(dateValue);
  }
};

// --- Components ---

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-natural-bg">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-natural-primary"></div>
  </div>
);

const ThemeSelector = ({ className = '', dropUp = false, lightMode = false }: { className?: string, dropUp?: boolean, lightMode?: boolean }) => {
  const { theme, setTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const currentTheme = themes.find(t => t.id === theme) || themes[0];

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-xs font-medium border shadow-xs ${
          lightMode 
            ? 'bg-white/80 hover:bg-white text-natural-text border-natural-border/80 hover:border-natural-primary/40 backdrop-blur-sm'
            : 'bg-white/10 hover:bg-white/20 text-white border-white/20 hover:border-white/40 backdrop-blur-sm'
        }`}
        title="Ganti Tema Warna Aplikasi"
      >
        <span 
          className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-xs shrink-0" 
          style={{ backgroundColor: currentTheme.primaryColor }}
        />
        <span className="hidden sm:inline font-sans text-xs font-medium">{currentTheme.name}</span>
        <Palette className="w-3.5 h-3.5 opacity-80" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: dropUp ? 10 : -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: dropUp ? 10 : -10 }}
              className={`absolute right-0 ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'} w-64 bg-white text-slate-800 rounded-2xl shadow-2xl border border-natural-border p-3 z-50 overflow-hidden`}
            >
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-natural-border/50 mb-2">
                <span className="text-[11px] font-bold text-natural-text uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-natural-primary" /> Pilih Tema Warna
                </span>
              </div>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {themes.map(t => {
                  const isActive = t.id === theme;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTheme(t.id);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-xl transition-all flex items-center justify-between group ${
                        isActive ? 'bg-natural-bg font-semibold border border-natural-primary/20' : 'hover:bg-natural-bg/50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex -space-x-1 shrink-0">
                          <span 
                            className="w-4 h-4 rounded-full border border-white shadow-xs" 
                            style={{ backgroundColor: t.primaryColor }}
                          />
                          <span 
                            className="w-4 h-4 rounded-full border border-white shadow-xs" 
                            style={{ backgroundColor: t.secondaryColor }}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-natural-text truncate leading-snug">{t.name}</p>
                          <p className="text-[10px] text-natural-secondary/80 font-normal truncate leading-tight">{t.desc}</p>
                        </div>
                      </div>
                      {isActive && <Check className="w-4 h-4 text-natural-primary shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

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
      
      <div className="flex items-center gap-4 sm:gap-6">
        <ThemeSelector />

        {user && (
          <div className="flex items-center gap-4 pr-4 sm:pr-6 border-r border-white/20">
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
    [ReportStatus.BUDGET_APPROVED]: { color: 'bg-[#ebf5e9] text-green-700 border-green-200', icon: CircleCheck, label: 'Anggaran Disetujui' },
    [ReportStatus.REPORTING]: { color: 'bg-[#e0f7fa] text-blue-700 border-blue-200', icon: FileText, label: 'Proses Pelaporan' },
    [ReportStatus.COMPLETED]: { color: 'bg-[#e8f5e9] text-emerald-700 border-emerald-200', icon: CircleCheck, label: 'Selesai' },
    [ReportStatus.ARCHIVED]: { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Lock, label: 'Arsip' },
    [ReportStatus.REJECTED]: { color: 'bg-[#fbeaea] text-red-700 border-red-200', icon: CircleX, label: 'Ditolak' },
    [ReportStatus.REVISION]: { color: 'bg-[#fff4e5] text-orange-700 border-orange-200', icon: RotateCw, label: 'Revisi Diperlukan' },
    [ReportStatus.INCOMPLETE]: { color: 'bg-[#fbeaea] text-red-700 border-red-200', icon: AlertCircle, label: 'Laporan Tidak Lengkap' },
  };
  const config = configs[status] || { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock, label: status || 'Status Baru' };
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-natural-bg p-6 relative">
      <div className="absolute top-6 right-6 z-10">
        <ThemeSelector lightMode />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[40px] p-12 shadow-xl border border-natural-border relative"
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
              <CircleUserRound className="w-3 h-3" /> Username
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
        
        <div className="mt-8 pt-6 border-t border-natural-border/50 flex flex-col items-center gap-3">
          <p className="text-[10px] text-natural-secondary uppercase tracking-[0.2em] font-bold text-center">
            Pusat Data Pertanggungjawaban
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const ReportForm = ({ onCancel, onSuccess, user, editReport, units, expenseTypes, employees, onPrintRAB }: { onCancel: () => void, onSuccess: () => void, user: AppUser, editReport?: Report, units: Unit[], expenseTypes: ExpenseType[], employees: Employee[], onPrintRAB?: (r: Report) => void }) => {
  const isAdmin = safeStorage.getItem('user_role') === 'admin';
  const [loading, setLoading] = useState(false);
  const [isWaVerified, setIsWaVerified] = useState<boolean>(Boolean(editReport?.whatsappVerified && editReport?.whatsappNumber));
  const [sendingOtp, setSendingOtp] = useState<boolean>(false);
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  const [inputOtp, setInputOtp] = useState<string>('');
  const [otpError, setOtpError] = useState<string>('');
  const [otpCountdown, setOtpCountdown] = useState<number>(0);

  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setTimeout(() => setOtpCountdown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

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
    submissionDate: editReport?.submissionDate || new Date().toISOString().split('T')[0],
    whatsappNumber: editReport?.whatsappNumber || '',
    includeWakaSignature: editReport?.includeWakaSignature !== undefined ? editReport.includeWakaSignature : false,
    wakaName: editReport?.wakaName || '',
    wakaJabatan: editReport?.wakaJabatan || 'Waka Urusan Terkait'
  });

  useEffect(() => {
    if (!editReport && !formData.unitId && !isAdmin) {
      const matched = units.find(u => u.name === user.unitName);
      if (matched) setFormData(prev => ({ ...prev, unitId: matched.id, unitName: matched.name }));
    }
  }, [units, user.unitName, editReport, isAdmin, formData.unitId]);

  const updateProposedDetails = (newDetails: ExpenseDetail[]) => {
    const total = Math.round(newDetails.reduce((sum, d) => sum + (Number(d.amount) || 0), 0) * 10000) / 10000;
    setFormData(prev => ({ ...prev, proposedDetails: newDetails, amountReceived: total }));
  };

  const addDetail = (isProposed: boolean) => {
    if (isProposed) {
      updateProposedDetails([...formData.proposedDetails, { date: new Date().toISOString().split('T')[0], description: '', amount: 0, category: '' }]);
    } else {
      setFormData({ ...formData, details: [...formData.details, { noBukti: '', date: '', description: '', amount: 0, proposedIndex: undefined }] });
    }
  };

  const handleSendWaVerification = async () => {
    const rawNumber = formData.whatsappNumber.trim();
    if (!rawNumber || rawNumber.length < 9) {
      safeAlert('Masukkan nomor WhatsApp yang valid terlebih dahulu (minimal 9 digit, contoh: 081234567890).');
      return;
    }

    setSendingOtp(true);
    setOtpError('');
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);

    try {
      const selectedUnit = units.find(u => u.id === formData.unitId);
      const res = await sendWhatsappVerificationCode({
        phone: rawNumber,
        code: code,
        unitName: selectedUnit?.name || formData.unitName,
        activityName: formData.activityName,
        db
      });

      if (res.success) {
        setOtpSent(true);
        setOtpCountdown(60);
        setInputOtp('');
        safeAlert(`Kode verifikasi 6-digit berhasil dikirim ke nomor WhatsApp ${rawNumber}. Silakan periksa pesan WhatsApp Anda dan masukkan kodenya.`);
      } else {
        setOtpError(res.message);
        safeAlert(`Gagal mengirim verifikasi: ${res.message}\nPastikan nomor terdaftar aktif di WhatsApp dan Token Fonnte telah aktif.`);
      }
    } catch (e: any) {
      setOtpError(e.message || 'Terjadi kendala saat mengirim verifikasi.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyWaCode = () => {
    if (!inputOtp.trim()) {
      setOtpError('Masukkan 6 digit kode verifikasi yang diterima di WhatsApp.');
      return;
    }
    if (inputOtp.trim() === generatedOtp) {
      setIsWaVerified(true);
      setOtpSent(false);
      setOtpError('');
      safeAlert('Nomor WhatsApp BERHASIL TERVERIFIKASI AKTIF! Notifikasi status pengajuan hingga laporan selesai akan dikirim ke nomor ini.');
    } else {
      setOtpError('Kode verifikasi salah. Mohon periksa kembali pesan WhatsApp Anda.');
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

  const totalSpent = Math.round(formData.details.reduce((sum, d) => sum + (Number(d.amount) || 0), 0) * 10000) / 10000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unitId || !formData.activityName) return;

    if (!formData.whatsappNumber || !formData.whatsappNumber.trim()) {
      safeAlert('Nomor WhatsApp Pengaju wajib diisi! Anggaran tidak dapat diajukan tanpa nomor WhatsApp untuk notifikasi status.');
      return;
    }

    if (!isWaVerified && !isAdmin) {
      safeAlert('Nomor WhatsApp wajib diverifikasi aktif terlebih dahulu!\nSilakan klik tombol "Verifikasi Nomor WhatsApp" untuk memastikan nomor aktif menerima notifikasi.');
      return;
    }

    setLoading(true);
    try {
      const selectedUnit = units.find(u => u.id === formData.unitId);

      // Check if any details are missing No. Bukti Transaksi
      if (formData.details && formData.details.length > 0) {
        const missingNoBukti = formData.details.some(d => !d.noBukti || !d.noBukti.trim());
        if (missingNoBukti) {
          safeAlert('No. Bukti Transaksi wajib diisi untuk setiap rincian realisasi anggaran!');
          setLoading(false);
          return;
        }
      }

      // Check if any "belanja pegawai" details are missing an employee selection
      let isEmployeeMissing = false;
      if (formData.details && formData.details.length > 0) {
        for (const detail of formData.details) {
          if (detail.proposedIndex !== undefined) {
            const budgetItem = formData.proposedDetails[detail.proposedIndex];
            const isPegawai = budgetItem?.category?.toLowerCase().includes('pegawai');
            if (isPegawai && !detail.employeeId) {
              isEmployeeMissing = true;
              break;
            }
          }
        }
      }

      const getNextStatus = () => {
        if (!editReport) return ReportStatus.BUDGET_PROPOSAL;
        if (editReport.status === ReportStatus.REVISION) {
          // If revision, check if it was for budget or report
          return editReport.details.length > 0 ? ReportStatus.REPORTING : ReportStatus.BUDGET_PROPOSAL;
        }
        if (editReport.status === ReportStatus.INCOMPLETE) {
          return ReportStatus.REPORTING;
        }
        return editReport.status;
      };

      const finalStatus = isEmployeeMissing ? ReportStatus.INCOMPLETE : getNextStatus();

      const payload = {
        unitId: formData.unitId,
        unitName: selectedUnit?.name || formData.unitName || 'Unknown',
        activityName: formData.activityName,
        amountReceived: Number(formData.amountReceived),
        totalSpent: totalSpent,
        details: formData.details,
        proposedDetails: formData.proposedDetails,
        status: finalStatus,
        submittedAt: editReport?.submittedAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        submittedBy: editReport?.submittedBy || user.uid,
        ketuaName: formData.ketuaName,
        ketuaJabatan: formData.ketuaJabatan,
        bendaharaName: formData.bendaharaName,
        bendaharaJabatan: formData.bendaharaJabatan,
        submissionDate: formData.submissionDate,
        whatsappNumber: formData.whatsappNumber || '',
        whatsappVerified: isWaVerified || isAdmin,
        whatsappVerifiedAt: isWaVerified ? new Date().toISOString() : undefined,
        includeWakaSignature: Boolean(formData.includeWakaSignature),
        wakaName: formData.wakaName || '',
        wakaJabatan: formData.wakaJabatan || ''
      };

      if (editReport?.id) {
        await setDoc(doc(db, 'reports', editReport.id), payload as any, { merge: true });
        // Jika ada perubahan status dan nomor WhatsApp terisi, kirim notifikasi
        if (finalStatus !== editReport.status && formData.whatsappNumber) {
          sendReportStatusNotification({ id: editReport.id, ...payload } as any, finalStatus, undefined, db).catch(console.error);
        }
      } else {
        const newDocRef = await addDoc(collection(db, 'reports'), payload as any);
        // Kirim notifikasi pengajuan baru via WhatsApp ke pengaju
        if (formData.whatsappNumber) {
          sendReportStatusNotification({ id: newDocRef.id, ...payload } as any, ReportStatus.BUDGET_PROPOSAL, undefined, db).catch(console.error);
        }
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
      className="max-w-5xl mx-auto py-10"
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

          {/* Nomor WhatsApp Pengaju & Verifikasi Aktif */}
          <div className={`p-6 border rounded-3xl space-y-4 transition-all ${isWaVerified ? 'bg-emerald-50/60 border-emerald-300' : 'bg-amber-50/50 border-amber-200'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs uppercase tracking-wider font-bold text-natural-primary flex items-center gap-2">
                <Smartphone className={`w-4 h-4 ${isWaVerified ? 'text-emerald-600' : 'text-amber-600'}`} />
                Nomor WhatsApp Pengaju (Wajib Terverifikasi Aktif) <span className="text-red-500 font-bold">*</span>
              </label>
              {isWaVerified ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Terverifikasi Aktif
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-300 flex items-center gap-1.5">
                  <KeyRound className="w-3 h-3 text-amber-600" />
                  Belum Terverifikasi
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input 
                type="tel"
                required
                className={`flex-1 p-4 bg-white rounded-2xl border text-sm font-mono font-bold focus:ring-2 outline-none placeholder:text-natural-secondary/50 transition-all ${isWaVerified ? 'border-emerald-300 text-emerald-950 focus:ring-emerald-400' : 'border-amber-300 text-natural-primary focus:ring-amber-400'}`}
                placeholder="Contoh: 081234567890"
                value={formData.whatsappNumber}
                onChange={(e) => {
                  setFormData({...formData, whatsappNumber: e.target.value});
                  if (isWaVerified) {
                    setIsWaVerified(false);
                    setOtpSent(false);
                  }
                }}
              />
              {!isWaVerified && (
                <button
                  type="button"
                  disabled={sendingOtp || otpCountdown > 0 || !formData.whatsappNumber.trim()}
                  onClick={handleSendWaVerification}
                  className="px-6 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-bold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  {sendingOtp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Mengirim...
                    </>
                  ) : otpCountdown > 0 ? (
                    `Kirim Ulang (${otpCountdown}s)`
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Verifikasi Nomor
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Form Input Kode OTP Verifikasi jika sudah dikirim */}
            {!isWaVerified && otpSent && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="p-4 bg-white rounded-2xl border border-amber-200 space-y-3 shadow-xs"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <KeyRound className="w-4 h-4 text-amber-600" />
                  <span>Masukkan 6-Digit Kode Verifikasi yang Diterima di WhatsApp</span>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    type="text"
                    maxLength={6}
                    className="flex-1 p-3 bg-amber-50/50 border border-amber-300 rounded-xl text-center font-mono font-bold text-lg tracking-[0.3em] outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="------"
                    value={inputOtp}
                    onChange={(e) => setInputOtp(e.target.value.replace(/\D/g, ''))}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyWaCode}
                    className="px-6 py-3 bg-natural-primary hover:bg-natural-primary/90 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Konfirmasi Kode
                  </button>
                </div>
                {otpError && (
                  <p className="text-xs text-red-600 font-bold">{otpError}</p>
                )}
                <p className="text-[11px] text-natural-secondary italic">
                  *Pesan berisi kode verifikasi telah dikirim via WhatsApp ke <strong>{formData.whatsappNumber}</strong>.
                </p>
              </motion.div>
            )}

            {isWaVerified ? (
              <p className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                Nomor WhatsApp terverifikasi aktif. Notifikasi penerimaan pengajuan, persetujuan anggaran, instruksi LPJ, revisi, hingga pengesahan laporan akan dikirim otomatis ke nomor ini.
              </p>
            ) : (
              <p className="text-xs text-amber-800 font-medium italic">
                *Nomor WhatsApp harus diverifikasi aktif sebelum anggaran diajukan. Klik "Verifikasi Nomor" untuk mengirim kode ke WhatsApp Anda.
              </p>
            )}
          </div>

          {/* Opsi Tanda Tangan Mengetahui Waka */}
          <div className="p-6 bg-natural-input/40 border border-natural-border rounded-3xl space-y-4">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={formData.includeWakaSignature}
                onChange={(e) => setFormData({...formData, includeWakaSignature: e.target.checked})}
                className="w-5 h-5 rounded-lg border-natural-border text-natural-primary focus:ring-natural-primary/20 accent-emerald-600 cursor-pointer"
              />
              <div>
                <span className="text-sm font-bold text-natural-primary block">
                  Cantumkan Tanda Tangan Mengetahui Waka
                </span>
                <span className="text-xs text-natural-secondary font-medium block">
                  Jika dicentang, kolom tanda tangan "Mengetahui Waka" akan dimunculkan pada cetakan RAB dan Laporan.
                </span>
              </div>
            </label>

            {formData.includeWakaSignature && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-4 border-t border-natural-border grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div className="space-y-1.5 focus-within:text-natural-primary transition-colors">
                  <label className="text-[10px] uppercase tracking-wider font-bold">Jabatan Waka</label>
                  <input 
                    className="w-full p-3.5 bg-white rounded-xl border border-natural-border text-sm font-medium focus:border-natural-primary outline-none"
                    value={formData.wakaJabatan}
                    placeholder="Contoh: Waka Urusan Kurikulum / Waka Urusan Kesiswaan / Waka Urusan Sarpras"
                    onChange={(e) => setFormData({...formData, wakaJabatan: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5 focus-within:text-natural-primary transition-colors">
                  <label className="text-[10px] uppercase tracking-wider font-bold">Nama Waka (Opsional)</label>
                  <input 
                    className="w-full p-3.5 bg-white rounded-xl border border-natural-border text-sm font-medium focus:border-natural-primary outline-none"
                    value={formData.wakaName}
                    placeholder="Nama Lengkap Waka (kosongkan jika tanda tangan di atas garis titik-titik)"
                    onChange={(e) => setFormData({...formData, wakaName: e.target.value})}
                  />
                </div>
              </motion.div>
            )}
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
                step="any"
                required
                disabled={!isAdmin}
                className="w-full pl-14 p-5 bg-natural-input border-b-2 border-natural-bg text-3xl font-mono font-bold text-natural-primary focus:bg-white focus:border-natural-primary outline-none disabled:opacity-60"
                value={formData.amountReceived}
                onChange={(e) => setFormData({...formData, amountReceived: parseAmount(e.target.value)})}
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
                  <div className="md:col-span-3 space-y-1">
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
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[9px] uppercase font-bold text-natural-secondary/60 text-right block">Nominal</label>
                    <input 
                      type="number"
                      step="any"
                      required
                      disabled={!!editReport && editReport.status !== ReportStatus.BUDGET_PROPOSAL && editReport.status !== ReportStatus.REVISION}
                      className="w-full p-2 bg-white rounded-xl border border-natural-border outline-none font-mono font-bold text-xs text-right disabled:bg-natural-bg/50 disabled:text-natural-secondary/70"
                      value={detail.amount}
                      onChange={(e) => {
                        const newD = [...formData.proposedDetails];
                        newD[idx].amount = parseAmount(e.target.value);
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
        {(editReport?.status === ReportStatus.REPORTING || editReport?.status === ReportStatus.INCOMPLETE || editReport?.status === ReportStatus.COMPLETED || (editReport?.status === ReportStatus.REVISION && editReport.details.length > 0)) && (
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
                        <p className="text-[10px] text-natural-secondary">Pagu: Rp {formatCurrency(p.amount)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono font-bold ${remaining < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          Sisa: Rp {formatCurrency(remaining)}
                        </p>
                        <p className="text-[10px] text-natural-secondary">Realisasi: Rp {formatCurrency(realizedSum)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              {formData.details.map((detail, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-natural-bg/20 p-6 rounded-[24px] border border-natural-bg relative group">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[9px] uppercase font-bold text-natural-secondary/60">
                      No. Bukti Transaksi <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text"
                      required
                      list={`bukti-list-${idx}`}
                      disabled={isAdmin}
                      className="w-full p-2 bg-white rounded-xl border border-natural-border outline-none text-xs font-bold font-mono disabled:bg-transparent"
                      placeholder="E.g. BK-01"
                      value={detail.noBukti || ''}
                      onChange={(e) => {
                        const newD = [...formData.details];
                        newD[idx].noBukti = e.target.value;
                        setFormData({...formData, details: newD});
                      }}
                    />
                    <datalist id={`bukti-list-${idx}`}>
                      {Array.from(new Set(formData.details.map(d => d.noBukti).filter(Boolean))).map((nb, nbi) => (
                        <option key={nbi} value={nb} />
                      ))}
                    </datalist>
                  </div>

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

                  <div className="md:col-span-2 space-y-1">
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
                             {p.description || `Anggaran #${pIdx + 1}`} (Sisa: Rp {formatCurrency(remaining)})
                           </option>
                         );
                       })}
                    </select>
                  </div>

                  <div className={detail.proposedIndex !== undefined && formData.proposedDetails[detail.proposedIndex]?.category?.toLowerCase().includes('pegawai') ? "md:col-span-2 space-y-1" : "md:col-span-3 space-y-1"}>
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

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[9px] uppercase font-bold text-natural-secondary/60 text-right block">Nominal</label>
                    <input 
                      type="number"
                      step="any"
                      required
                      disabled={isAdmin}
                      className="w-full p-2 bg-white rounded-xl border border-natural-border outline-none font-mono font-bold text-xs text-right disabled:bg-transparent"
                      value={detail.amount}
                      onChange={(e) => {
                        const newD = [...formData.details];
                        newD[idx].amount = parseAmount(e.target.value);
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
                 <p className="text-3xl font-mono font-bold text-natural-primary">Rp {formatCurrency(totalSpent)}</p>
               </div>
               <div className="text-right space-y-1">
                 <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-widest italic">Sisa Anggaran</p>
                 <p className={`text-xl font-mono font-bold ${formData.amountReceived - totalSpent < 0 ? 'text-red-500' : 'text-natural-secondary'}`}>
                   Rp {formatCurrency((formData.amountReceived || 0) - totalSpent)}
                 </p>
               </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            type="button"
            onClick={onCancel}
            className="flex-1 py-4 bg-white border border-natural-border text-natural-primary rounded-full font-serif italic text-base hover:bg-natural-input transition-all"
          >
            Tutup
          </button>
          {editReport && (editReport.status === ReportStatus.REPORTING || editReport.status === ReportStatus.INCOMPLETE || (editReport.status === ReportStatus.REVISION && editReport.details && editReport.details.length > 0)) && (
            <button
              type="button"
              onClick={async () => {
                if (safeConfirm('Batalkan input realisasi dan kembalikan status kegiatan ini ke "Anggaran Disetujui" di menu Anggaran?')) {
                  setLoading(true);
                  try {
                    await setDoc(doc(db, 'reports', editReport.id!), {
                      status: ReportStatus.BUDGET_APPROVED,
                      updatedAt: serverTimestamp(),
                      completedAt: null,
                      completedDate: null
                    }, { merge: true });
                    onSuccess();
                  } catch (err) {
                    handleFirestoreError(err, OperationType.UPDATE, `reports/${editReport.id}`);
                  } finally {
                    setLoading(false);
                  }
                }
              }}
              className="flex-1 py-4 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-serif italic text-base hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
              title="Batalkan pengisian realisasi dan kembalikan ke menu Anggaran Disetujui"
            >
              <Undo2 className="w-4 h-4 text-slate-600" />
              Batal Input Realisasi (Kembali ke Anggaran)
            </button>
          )}
          <button 
            disabled={loading}
            type="submit" 
            className="flex-1 py-4 bg-natural-primary text-white rounded-full font-serif italic text-base shadow-xl shadow-natural-primary/20 hover:bg-natural-primary/90 transition-all flex items-center justify-center gap-2"
          >
            {loading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />}
            {editReport ? 'Simpan Perubahan Laporan' : (isAdmin ? 'Terbitkan Mandat Anggaran' : 'Kirim Pengajuan Anggaran')}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

const getReportDateTimestamp = (report: Report): number => {
  // 1. Try submissionDate (e.g. '2026-08-22')
  if (report.submissionDate) {
    const t = new Date(report.submissionDate).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  // 2. Try submittedAt (Firestore Timestamp or Date/string)
  if (report.submittedAt) {
    if (typeof report.submittedAt.toDate === 'function') {
      return report.submittedAt.toDate().getTime();
    }
    if (typeof report.submittedAt.seconds === 'number') {
      return report.submittedAt.seconds * 1000;
    }
    const t = new Date(report.submittedAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  // 3. Try updatedAt
  if (report.updatedAt) {
    if (typeof report.updatedAt.toDate === 'function') {
      return report.updatedAt.toDate().getTime();
    }
    if (typeof report.updatedAt.seconds === 'number') {
      return report.updatedAt.seconds * 1000;
    }
    const t = new Date(report.updatedAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  // 4. Try latest date in details
  if (report.details && report.details.length > 0) {
    const detailDates = report.details
      .map(d => d.date ? new Date(d.date).getTime() : 0)
      .filter(t => !isNaN(t) && t > 0);
    if (detailDates.length > 0) {
      return Math.max(...detailDates);
    }
  }
  return 0;
};

const ReportTable = ({ reports, isAdmin, allowedStatuses, onSelect, onPrint, onPrintRAB, onDelete }: { reports: Report[], isAdmin: boolean, allowedStatuses: ReportStatus[], onSelect: (r: Report) => void, onPrint: (r: Report) => void, onPrintRAB?: (r: Report) => void, onDelete: (r: Report) => void }) => {
  const filteredReports = useMemo(() => {
    const filtered = reports.filter(r => {
      if (!allowedStatuses.includes(r.status)) return false;
      if (r.status === ReportStatus.REVISION) {
        const hasRealization = r.details && r.details.length > 0;
        const isBudgetView = allowedStatuses.includes(ReportStatus.BUDGET_PROPOSAL);
        const isReportView = allowedStatuses.includes(ReportStatus.REPORTING);
        if (isBudgetView && hasRealization) return false;
        if (isReportView && !hasRealization) return false;
      }
      return true;
    });

    // Urutkan berdasarkan tanggal: yang terbaru di urutan paling atas
    return filtered.sort((a, b) => {
      const timeA = getReportDateTimestamp(a);
      const timeB = getReportDateTimestamp(b);
      return timeB - timeA;
    });
  }, [reports, allowedStatuses]);

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
            <div className="flex justify-between items-start mb-6 gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={report.status} />
                {(report.submissionDate || report.submittedAt) && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-medium text-natural-secondary bg-natural-bg px-2.5 py-1 rounded-full border border-natural-border/60">
                    <Calendar className="w-3 h-3 text-natural-secondary/70" />
                    {formatDate(report.submissionDate || report.submittedAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {onPrintRAB && (report.status === ReportStatus.REPORTING || report.status === ReportStatus.INCOMPLETE || report.status === ReportStatus.COMPLETED || report.status === ReportStatus.ARCHIVED) && (
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
              
              <div className="flex flex-wrap gap-1.5 mt-3">
                {Array.from(new Set((report.proposedDetails || []).map(pd => pd?.category))).map((cat, ci) => (
                  cat && (
                    <span key={ci} className="px-2 py-0.5 bg-natural-primary/5 text-natural-primary text-[8px] font-bold uppercase rounded-md border border-natural-primary/10">
                      {cat}
                    </span>
                  )
                ))}
              </div>
              
              <div className="mt-8 pt-6 border-t border-natural-bg space-y-4">
                {allowedStatuses.includes(ReportStatus.REPORTING) || allowedStatuses.includes(ReportStatus.COMPLETED) || allowedStatuses.includes(ReportStatus.INCOMPLETE) ? (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="space-y-0.5">
                      <span className="text-[8px] font-bold text-natural-secondary/60 uppercase tracking-widest block">Anggaran</span>
                      <span className="font-mono text-[11px] font-bold text-natural-primary">Rp {formatCurrency(report.amountReceived)}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[8px] font-bold text-natural-secondary/60 uppercase tracking-widest block">Realisasi</span>
                      <span className="font-mono text-[11px] font-bold text-natural-secondary">Rp {formatCurrency(report.totalSpent)}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[8px] font-bold text-natural-secondary/60 uppercase tracking-widest block">
                        {(report.amountReceived || 0) - (report.totalSpent || 0) < 0 ? 'Kekurangan' : 'Sisa'}
                      </span>
                      <span className={`font-mono text-[11px] font-bold ${(report.amountReceived || 0) - (report.totalSpent || 0) < 0 ? 'text-rose-600' : 'text-[#829273]'}`}>
                        {(report.amountReceived || 0) - (report.totalSpent || 0) < 0 
                          ? `-Rp ${formatCurrency(Math.abs((report.amountReceived || 0) - (report.totalSpent || 0)))}` 
                          : `Rp ${formatCurrency((report.amountReceived || 0) - (report.totalSpent || 0))}`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 pb-2">
                    <span className="text-[10px] font-bold text-natural-secondary/40 uppercase tracking-widest block">Total Anggaran Pagu</span>
                    <span className="font-mono font-bold text-natural-primary text-xl tracking-tight">Rp {formatCurrency(report.amountReceived)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center bg-natural-bg/30 p-3 rounded-2xl group-hover:bg-natural-primary group-hover:text-white transition-all text-[#a5a58d]">
                  <span className="text-[9px] font-bold uppercase tracking-[0.3em]">
                    {allowedStatuses.includes(ReportStatus.REPORTING) || allowedStatuses.includes(ReportStatus.COMPLETED) || allowedStatuses.includes(ReportStatus.INCOMPLETE) ? 'Buka Detail Laporan' : 'Buka Detail Anggaran'}
                  </span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
};

const ReportDetail = ({ report, onBack, isAdmin, onEdit, onPrint, onPrintRAB, onUpdateStatus }: { report: Report, onBack: () => void, isAdmin: boolean, onEdit: () => void, onPrint: () => void, onPrintRAB?: (r: Report) => void, onUpdateStatus: (id: string, s: ReportStatus, n?: string, d?: string) => Promise<void> }) => {
  const [notes, setNotes] = useState(report.treasurerNotes || '');
  const [updating, setUpdating] = useState(false);

  const [showInstructModal, setShowInstructModal] = useState(false);
  const [instructDateInput, setInstructDateInput] = useState(() => {
    if (report.reportingInstructedDate) return report.reportingInstructedDate;
    return new Date().toISOString().split('T')[0];
  });
  const [editingInstructDate, setEditingInstructDate] = useState(false);
  const [customInstructDate, setCustomInstructDate] = useState(report.reportingInstructedDate || new Date().toISOString().split('T')[0]);
  const [savingInstructDate, setSavingInstructDate] = useState(false);

  const handleSaveInstructDate = async () => {
    if (!report.id || !customInstructDate) return;
    setSavingInstructDate(true);
    try {
      await setDoc(doc(db, 'reports', report.id), {
        reportingInstructedDate: customInstructDate,
        updatedAt: serverTimestamp()
      }, { merge: true });
      report.reportingInstructedDate = customInstructDate;
      setEditingInstructDate(false);
    } catch (e) {
      console.error('Failed to update instruction date:', e);
    } finally {
      setSavingInstructDate(false);
    }
  };

  const handleUpdateStatusAction = async (status: ReportStatus, customDate?: string) => {
    if (!report.id) return;
    setUpdating(true);
    try {
      await onUpdateStatus(report.id, status, notes, customDate);
      onBack();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const balance = report.amountReceived - report.totalSpent;
  const [editingWa, setEditingWa] = useState(false);
  const [waNumberInput, setWaNumberInput] = useState(report.whatsappNumber || '');
  const [savingWa, setSavingWa] = useState(false);

  const handleSaveWaNumber = async () => {
    if (!report.id) return;
    setSavingWa(true);
    try {
      await setDoc(doc(db, 'reports', report.id), {
        whatsappNumber: waNumberInput.trim(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      report.whatsappNumber = waNumberInput.trim();
      setEditingWa(false);
    } catch (e) {
      console.error('Failed to update WhatsApp number:', e);
    } finally {
      setSavingWa(false);
    }
  };

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
           {onPrintRAB && (report.status === ReportStatus.REPORTING || report.status === ReportStatus.INCOMPLETE || report.status === ReportStatus.COMPLETED || report.status === ReportStatus.ARCHIVED) && (
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

      {/* WhatsApp Notification Card */}
      <div className="bg-white p-6 rounded-[32px] border border-emerald-200/80 shadow-xs mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#25D366]/15 flex items-center justify-center text-[#128C7E] flex-shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Notifikasi WhatsApp Pengaju
              </span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${report.whatsappVerified ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : report.whatsappNumber ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {report.whatsappVerified ? '✅ Terverifikasi Aktif' : report.whatsappNumber ? 'Nomor Terdaftar' : 'Belum Ada Nomor'}
              </span>
            </div>
            {editingWa ? (
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="tel"
                  className="p-2 px-3 border border-emerald-300 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="081234567890"
                  value={waNumberInput}
                  onChange={e => setWaNumberInput(e.target.value)}
                />
                <button
                  type="button"
                  disabled={savingWa}
                  onClick={handleSaveWaNumber}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all"
                >
                  {savingWa ? '...' : 'Simpan'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingWa(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Batal
                </button>
              </div>
            ) : (
              <p className="text-sm font-mono font-bold text-natural-primary mt-0.5">
                {report.whatsappNumber || <span className="text-natural-secondary/60 italic font-sans font-normal">Tidak ada nomor (klik edit untuk menambahkan)</span>}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {!editingWa && (
            <button
              onClick={() => { setWaNumberInput(report.whatsappNumber || ''); setEditingWa(true); }}
              className="text-[10px] uppercase font-bold text-natural-secondary hover:text-natural-primary px-3 py-1.5 rounded-full border border-natural-border bg-natural-input/50 transition-colors"
            >
              {report.whatsappNumber ? 'Ubah Nomor' : '+ Tambah Nomor'}
            </button>
          )}
          {report.whatsappNumber && (
            <a 
              href={`https://wa.me/${report.whatsappNumber.replace(/\D/g, '').replace(/^0/, '62')}`} 
              target="_blank" 
              rel="noreferrer"
              className="text-[10px] uppercase font-bold text-[#128C7E] hover:bg-[#25D366]/10 px-3 py-1.5 rounded-full border border-[#25D366]/30 transition-all flex items-center gap-1.5"
            >
              <Send className="w-3 h-3" />
              Buka Chat WA
            </a>
          )}
        </div>
      </div>

      {/* Date & Buku Kas Timeline Card */}
      <div className="bg-white p-6 rounded-[32px] border border-natural-border shadow-xs mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-700 flex-shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-natural-secondary">
                Tanggal Instruksi Laporan (Pencatatan Buku Kas)
              </span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                report.reportingInstructedDate 
                  ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                  : 'bg-zinc-100 text-zinc-600'
              }`}>
                {report.reportingInstructedDate ? 'Tercatat di Buku Kas' : 'Belum Diinstruksikan'}
              </span>
            </div>
            {editingInstructDate ? (
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="date"
                  className="p-2 px-3 border border-amber-300 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-amber-400"
                  value={customInstructDate}
                  onChange={e => setCustomInstructDate(e.target.value)}
                />
                <button
                  type="button"
                  disabled={savingInstructDate}
                  onClick={handleSaveInstructDate}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all"
                >
                  {savingInstructDate ? '...' : 'Simpan'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingInstructDate(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Batal
                </button>
              </div>
            ) : (
              <p className="text-sm font-mono font-bold text-natural-primary mt-0.5">
                {report.reportingInstructedDate ? formatDate(report.reportingInstructedDate, { dateStyle: 'medium' }) : (
                  <span className="text-natural-secondary/60 italic font-sans font-normal text-xs">
                    Mengikuti tanggal saat anggaran diinstruksikan menjadi laporan
                  </span>
                )}
              </p>
            )}
            <p className="text-[10px] text-natural-secondary mt-1">
              *Di Buku Kas, tanggal urutan transaksi dicatat saat anggaran diinstruksikan menjadi laporan (bukan tertanggal disetujui awal pagu).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {isAdmin && !editingInstructDate && (
            <button
              onClick={() => {
                setCustomInstructDate(report.reportingInstructedDate || new Date().toISOString().split('T')[0]);
                setEditingInstructDate(true);
              }}
              className="text-[10px] uppercase font-bold text-natural-secondary hover:text-natural-primary px-3 py-1.5 rounded-full border border-natural-border bg-natural-input/50 transition-colors"
            >
              {report.reportingInstructedDate ? 'Ubah Tgl Instruksi' : '+ Atur Tgl Instruksi'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
        <div className="bg-white p-8 rounded-[32px] border border-natural-border shadow-sm">
          <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-widest mb-2 italic">Dana Dari Bendahara</p>
          <p className="text-3xl font-mono font-bold text-natural-primary">Rp {formatCurrency(report.amountReceived)}</p>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-natural-border shadow-sm">
          <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-widest mb-2 italic">Total Penggunaan</p>
          <p className="text-3xl font-mono font-bold text-natural-primary">Rp {formatCurrency(report.totalSpent)}</p>
        </div>
        <div className={`p-8 rounded-[32px] border ${balance >= 0 ? 'bg-natural-bg/50 border-natural-secondary/20' : 'bg-red-50 border-red-100'}`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 italic ${balance >= 0 ? 'text-natural-secondary' : 'text-red-500'}`}>
            {balance >= 0 ? 'Sisa Saldo di Unit' : 'Kekurangan Anggaran (Defisit)'}
          </p>
          <p className={`text-3xl font-mono font-bold ${balance >= 0 ? 'text-natural-primary' : 'text-red-700'}`}>
            Rp {formatCurrency(Math.abs(balance))}
          </p>
          {balance < 0 && (
            <p className="text-xs text-rose-600 mt-2 italic font-medium">
              *Realisasi melebihi pagu anggaran disetujui. Kekurangan sebesar Rp {formatCurrency(Math.abs(balance))} dimasukkan ke Penerimaan Buku Kas untuk pengembalian/talangan oleh bendahara.
            </p>
          )}
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
                  <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic">Kategori</th>
                  <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic">Deskripsi Item</th>
                  <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] text-right italic">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-natural-bg/50">
                {((report as any).proposedDetails || []).map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-natural-input transition-colors">
                    <td className="px-10 py-6 font-mono text-xs text-natural-secondary">{String(idx + 1).padStart(2, '0')}</td>
                    <td className="px-10 py-6 text-natural-primary font-bold text-xs uppercase italic">{item?.category || '-'}</td>
                    <td className="px-10 py-6 text-natural-text font-medium italic">"{item?.description || ''}"</td>
                    <td className="px-10 py-6 text-natural-primary font-mono font-bold text-right text-lg">Rp {formatCurrency(item?.amount)}</td>
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
              <p className="text-xs text-natural-secondary uppercase tracking-widest mt-2">{report.submissionDate ? `Dibuat pada: ${formatDate(report.submissionDate)}` : ''}</p>
            </div>
            {report.includeWakaSignature && (
              <div className="col-span-2 text-center mt-4 pt-4 border-t border-natural-bg/70">
                <p className="text-xs font-bold text-natural-secondary uppercase tracking-widest mb-1 italic">Mengetahui</p>
                <p className="text-sm font-bold">{report.wakaJabatan || 'Waka Urusan Terkait'}</p>
                <p className="text-sm font-bold border-b border-natural-bg inline-block px-4 mt-1">{report.wakaName || '........................................'}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[40px] border border-natural-border shadow-sm overflow-hidden mb-10">
          <div className="px-10 py-8 border-b border-natural-bg flex flex-wrap justify-between items-center gap-4">
            <div>
              <h3 className="font-serif italic text-2xl text-natural-primary">Rincian Laporan</h3>
              <p className="text-natural-secondary text-xs uppercase tracking-widest font-bold mt-1">Itemized Expense Report</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* User edit button */}
              {!isAdmin && (report.status === ReportStatus.BUDGET_PROPOSAL || report.status === ReportStatus.REPORTING || report.status === ReportStatus.REVISION || report.status === ReportStatus.INCOMPLETE) && (
                <button 
                  onClick={onEdit}
                  className="bg-natural-primary text-white px-5 py-2.5 rounded-full font-serif italic text-xs hover:bg-natural-primary/90 transition-all shadow-md flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Lengkapi / Edit Rincian
                </button>
              )}

              {/* Batal Input Realisasi -> Revert to BUDGET_APPROVED (available for both admin and user when in reporting/incomplete/revision state) */}
              {(report.status === ReportStatus.REPORTING || report.status === ReportStatus.INCOMPLETE || (report.status === ReportStatus.REVISION && report.details && report.details.length > 0)) && (
                <button 
                  onClick={() => {
                    if (safeConfirm('Batalkan input realisasi kegiatan ini? Status akan dikembalikan menjadi "Anggaran Disetujui" di menu Anggaran.')) {
                      handleUpdateStatusAction(ReportStatus.BUDGET_APPROVED);
                    }
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-5 py-2.5 rounded-full font-serif italic text-xs transition-all shadow-xs flex items-center gap-1.5"
                  title="Kembalikan ke status Anggaran Disetujui di menu Anggaran"
                >
                  <Undo2 className="w-3.5 h-3.5 text-slate-600" />
                  Batal Input Realisasi (Kembali ke Anggaran)
                </button>
              )}

              {/* Admin: Start reporting */}
              {isAdmin && report.status === ReportStatus.BUDGET_APPROVED && (
                <button 
                  onClick={() => setShowInstructModal(true)}
                  className="bg-natural-secondary text-white px-5 py-2.5 rounded-full font-serif italic text-xs hover:bg-natural-secondary/90 transition-all shadow-md flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Instruksikan Pengisian Laporan (Pindah ke Menu Laporan)
                </button>
              )}

              {/* Admin: Completed status actions (Batal Setujui Laporan, Revisi, Arsip) */}
              {isAdmin && report.status === ReportStatus.COMPLETED && (
                <div className="flex flex-wrap items-center gap-2">
                  <button 
                    onClick={() => {
                      if (safeConfirm('Batalkan persetujuan laporan ini? Status akan dikembalikan ke "Pelaporan" agar dapat ditinjau atau diedit kembali.')) {
                        handleUpdateStatusAction(ReportStatus.REPORTING);
                      }
                    }}
                    className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-5 py-2.5 rounded-full font-serif italic text-xs transition-all shadow-xs flex items-center gap-1.5"
                    title="Batalkan status selesai dan kembalikan ke proses pelaporan"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-amber-800" />
                    Batal Setujui Laporan (Kembali ke Pelaporan)
                  </button>
                  <button 
                    onClick={() => handleUpdateStatusAction(ReportStatus.REVISION)}
                    className="bg-orange-600 text-white px-5 py-2.5 rounded-full font-serif italic text-xs hover:bg-orange-700 transition-all shadow-md"
                  >
                    Revisi Laporan
                  </button>
                  <button 
                    onClick={() => handleUpdateStatusAction(ReportStatus.ARCHIVED)}
                    className="bg-natural-primary text-white px-5 py-2.5 rounded-full font-serif italic text-xs hover:bg-natural-primary/90 transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Setujui Laporan (Arsipkan)
                  </button>
                </div>
              )}

              {/* Admin: Reporting status actions */}
              {isAdmin && (report.status === ReportStatus.REPORTING || report.status === ReportStatus.INCOMPLETE) && (
                <div className="flex flex-wrap items-center gap-2">
                  <button 
                    onClick={() => handleUpdateStatusAction(ReportStatus.REVISION)}
                    className="bg-orange-600 text-white px-5 py-2.5 rounded-full font-serif italic text-xs hover:bg-orange-700 transition-all shadow-md"
                  >
                    Instruksikan Revisi
                  </button>
                  <button 
                    onClick={() => handleUpdateStatusAction(ReportStatus.COMPLETED)}
                    className="bg-emerald-600 text-white px-5 py-2.5 rounded-full font-serif italic text-xs hover:bg-emerald-700 transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Setujui & Selesaikan Laporan
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="p-0">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-natural-bg/30">
                  <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] w-16 italic">#</th>
                  <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic">No. Bukti</th>
                  <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic">Tanggal</th>
                  <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic">Kategori</th>
                  <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic">Deskripsi Item</th>
                  <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic">Pegawai</th>
                  <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] text-right italic">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-natural-bg/50">
                {report.details.map((item, idx) => {
                  const budgetItem = report.proposedDetails && item.proposedIndex !== undefined ? report.proposedDetails[item.proposedIndex] : null;
                  const isPegawai = budgetItem?.category?.toLowerCase().includes('pegawai') || item.category?.toLowerCase().includes('pegawai');
                  return (
                    <tr key={idx} className="hover:bg-natural-input transition-colors">
                      <td className="px-10 py-6 font-mono text-xs text-natural-secondary">{String(idx + 1).padStart(2, '0')}</td>
                      <td className="px-10 py-6 font-mono font-bold text-xs text-natural-primary">{item.noBukti || '-'}</td>
                      <td className="px-10 py-6 text-natural-text text-sm">{item.date}</td>
                      <td className="px-10 py-6 text-natural-secondary font-bold text-[10px] uppercase italic">
                        {item.proposedIndex !== undefined ? report.proposedDetails[item.proposedIndex]?.category : '-'}
                      </td>
                      <td className="px-10 py-6 text-natural-text font-medium italic">"{item.description}"</td>
                      <td className="px-10 py-6 text-natural-text text-xs italic">
                        {isPegawai ? (
                          <span className="bg-zinc-100 px-3 py-1.5 rounded-full text-zinc-800 text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1">
                            👤 {item.employeeName || 'Belum dipilih'}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-10 py-6 text-natural-primary font-mono font-bold text-right text-lg">Rp {formatCurrency(item?.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rekapitulasi Penerimaan Biaya Pegawai (Interactive summary container) */}
        {report.proposedDetails?.some(b => b.category?.toLowerCase().includes('pegawai')) && (() => {
          const employeeRecap: { [name: string]: number } = {};
          (report.details || []).forEach(d => {
            const budgetItem = report.proposedDetails && d.proposedIndex !== undefined ? report.proposedDetails[d.proposedIndex] : null;
            const isPegawai = budgetItem?.category?.toLowerCase().includes('pegawai') || d.category?.toLowerCase().includes('pegawai');
            if (isPegawai) {
              const name = d.employeeName || 'Belum Ditentukan';
              employeeRecap[name] = (employeeRecap[name] || 0) + (d.amount || 0);
            }
          });

          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[40px] border border-natural-border shadow-sm overflow-hidden mb-10"
            >
              <div className="px-10 py-8 border-b border-natural-bg">
                <h3 className="font-serif italic text-2xl text-natural-primary">Rekapitulasi Penerimaan Biaya Pegawai</h3>
                <p className="text-natural-secondary text-xs uppercase tracking-widest font-bold mt-1">Summary of Personnel/Employee Expense Payments</p>
              </div>
              <div className="p-0">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-natural-bg/30">
                      <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] w-24 italic">No</th>
                      <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] italic">Nama Pegawai</th>
                      <th className="px-10 py-5 text-[11px] font-bold text-natural-secondary uppercase tracking-[0.2em] text-right italic">Total Penerimaan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-natural-bg/50">
                    {Object.keys(employeeRecap).length > 0 ? (
                      Object.entries(employeeRecap).map(([name, sum], idx) => (
                        <tr key={idx} className="hover:bg-natural-input transition-colors">
                          <td className="px-10 py-6 font-mono text-xs text-natural-secondary">{String(idx + 1).padStart(2, '0')}</td>
                          <td className="px-10 py-6 text-natural-text text-sm font-semibold uppercase tracking-wider">{name}</td>
                          <td className="px-10 py-6 text-natural-primary font-mono font-bold text-right text-lg">Rp {formatCurrency(sum)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-10 py-8 text-center text-natural-secondary italic text-sm">
                          Belum ada realisasi pembayaran pegawai.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {Object.keys(employeeRecap).length > 0 && (
                    <tfoot>
                      <tr className="bg-natural-input/50 font-bold border-t border-natural-border">
                        <td colSpan={2} className="px-10 py-6 text-right text-xs uppercase tracking-wider text-natural-secondary">Total Pengeluaran Pegawai</td>
                        <td className="px-10 py-6 text-right text-lg font-mono text-natural-primary">
                          Rp {formatCurrency(Object.values(employeeRecap).reduce((a, b) => a + b, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </motion.div>
          );
        })()}

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

      {/* Modal Dialog Instruksikan Pengisian Laporan */}
      {showInstructModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] p-6 max-w-md w-full border border-natural-border shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif italic font-bold text-lg text-natural-primary">
                  Instruksikan Pengisian Laporan
                </h3>
                <p className="text-[11px] text-natural-secondary">
                  Pencatatan Alokasi Dana ke Buku Kas
                </p>
              </div>
            </div>

            <p className="text-xs text-natural-secondary leading-relaxed">
              Anggaran kegiatan <strong>{report.activityName}</strong> akan dipindahkan ke menu <strong>Laporan</strong> dan dicatatkan ke dalam <strong>Buku Kas</strong> pada tanggal instruksi/pencairan di bawah ini.
            </p>

            <div className="space-y-1.5 pt-2">
              <label className="text-[10px] uppercase tracking-wider font-bold text-natural-primary block">
                Tanggal Instruksi Laporan / Pencairan Dana ke Unit (Buku Kas)
              </label>
              <input 
                type="date"
                required
                className="w-full p-3 bg-natural-input border border-natural-border rounded-xl text-sm font-bold font-mono focus:bg-white focus:border-natural-primary outline-none"
                value={instructDateInput}
                onChange={(e) => setInstructDateInput(e.target.value)}
              />
              <p className="text-[10px] text-amber-800 italic">
                *Sesuai ketentuan, tanggal urutan transaksi di Buku Kas dicatat berdasarkan tanggal instruksi ini (bukan tertanggal disetujui awal anggaran).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider font-bold text-natural-primary block">
                Catatan Bendahara untuk Unit (Opsional)
              </label>
              <textarea 
                className="w-full p-3 bg-natural-input border border-natural-border rounded-xl text-xs font-medium focus:bg-white focus:border-natural-primary outline-none resize-none"
                rows={2}
                placeholder="Pesan tambahan untuk unit pengaju..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-natural-border">
              <button
                type="button"
                onClick={() => setShowInstructModal(false)}
                disabled={updating}
                className="px-4 py-2 rounded-full border border-natural-border text-natural-secondary text-xs font-bold hover:bg-natural-bg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowInstructModal(false);
                  handleUpdateStatusAction(ReportStatus.REPORTING, instructDateInput);
                }}
                disabled={updating || !instructDateInput}
                className="px-5 py-2 rounded-full bg-natural-secondary hover:bg-natural-secondary/90 text-white text-xs font-bold font-serif italic shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {updating ? 'Memproses...' : 'Konfirmasi Instruksikan'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

const DashboardStats = ({ reports }: { reports: Report[] }) => {
  const proposal = reports.filter(r => 
    r.status === ReportStatus.BUDGET_PROPOSAL || 
    (r.status === ReportStatus.REVISION && (!r.details || r.details.length === 0))
  ).length;
  const approved = reports.filter(r => r.status === ReportStatus.BUDGET_APPROVED).length;
  const reporting = reports.filter(r => 
    r.status === ReportStatus.REPORTING ||
    r.status === ReportStatus.INCOMPLETE ||
    (r.status === ReportStatus.REVISION && r.details && r.details.length > 0)
  ).length;

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
          <CircleCheck className="w-5 h-5 text-green-500" />
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

const UserList = ({ onAdd, onViewUnits }: { onAdd: () => void, onViewUnits: () => void }) => {
  const [users, setUsers] = useState<DBUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'app_users'), limit(100));
        const snap = await getDocs(q);
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() as any } as DBUser)));
      } catch (err: any) {
        if (err.message?.includes('Quota') || err.message?.includes('limit')) console.warn("Error fetching users: Quota Exceeded");
        else console.error("Error fetching users", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleDeleteUser = async (id: string, username: string) => {
    if (safeConfirm(`Hapus akun ${username}?`)) {
      try {
        // @ts-ignore
        await deleteDoc(doc(db, 'app_users', id));
        setUsers(prev => prev.filter(u => u.id !== id));
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
                  <td className="px-10 py-6">
                    <button 
                      onClick={onViewUnits}
                      className="text-natural-primary font-bold hover:underline underline-offset-4 text-left"
                    >
                      {data.displayName}
                    </button>
                  </td>
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

const UserForm = ({ onCancel, units, initialUnitName }: { onCancel: () => void, units: Unit[], initialUnitName?: string }) => {
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
    if (!formData.unitName && formData.role === 'user') {
      safeAlert('Pilih Unit Kerja terlebih dahulu');
      return;
    }
    setLoading(true);
    try {
      // Add to users
      await addDoc(collection(db, 'app_users'), formData);
      
      // Sync to units collection if it's a new unit (though we'll use a dropdown, so this might be redundant if we only pick from units)
      // but if we allow 'admin' without unit, we handle it
      if (formData.unitName) {
        const unitsSnap = await getDocs(query(collection(db, 'units'), where('name', '==', formData.unitName)));
        if (unitsSnap.empty) {
          await addDoc(collection(db, 'units'), { name: formData.unitName });
        }
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
        <button onClick={onCancel} className="p-3 hover:bg-white rounded-full transition-colors border border-natural-border bg-white shadow-sm">
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
            <select 
              required={formData.role === 'user'} 
              className="w-full p-3 bg-natural-input border-b border-natural-border focus:border-natural-primary outline-none" 
              value={formData.unitName} 
              onChange={e => {
                const val = e.target.value;
                setFormData({...formData, unitName: val, displayName: val}); // Usually Display Name follows unit name for users
              }}
            >
              <option value="">Pilih Unit...</option>
              {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
            </select>
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



const UnitList = ({ units }: { units: Unit[] }) => {
  const [newUnitName, setNewUnitName] = useState('');
  const [addingUnit, setAddingUnit] = useState(false);

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName) return;
    setAddingUnit(true);
    try {
      // Check if unit exists
      const existing = units.find(u => u.name.toLowerCase() === newUnitName.toLowerCase());
      if (existing) {
        safeAlert('Unit sudah terdaftar');
        return;
      }

      await addDoc(collection(db, 'units'), { name: newUnitName });
      
      setNewUnitName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'units');
    } finally {
      setAddingUnit(false);
    }
  };

  const handleDeleteUnit = async (id: string, name: string) => {
    if (safeConfirm(`Hapus unit kerja ${name}? Ini hanya menghapus daftar pilihan, data laporan tidak akan terhapus.`)) {
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
        <form onSubmit={handleAddUnit} className="flex flex-col md:flex-row gap-4">
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
            className="bg-natural-primary text-white px-8 py-4 rounded-full font-serif italic flex items-center justify-center gap-2 hover:bg-natural-primary/90 transition-all shadow-lg"
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
          {units.length === 0 ? (
            <div className="col-span-full py-20 text-center text-natural-secondary font-serif italic">Belum ada unit kerja terdaftar.</div>
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
    if (safeConfirm('Hapus kategori pengeluaran ini?')) {
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
    if (id && safeConfirm('Hapus pegawai ini dari daftar?')) {
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
  const navigate = useNavigate();
  const location = useLocation();
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>({
    schoolName: 'SMK MUHAMMADIYAH 1 NGADIREJO',
    schoolLogo: '',
    principalName: '',
    principalNbm: '',
    treasurerName: '',
    treasurerNbm: '',
    schoolAddress: 'Jl. Raya Candiroto, Ngaren, Ngadirejo, Temanggung, Jawa Tengah',
  });
  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [selectedUnitFolder, setSelectedUnitFolder] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [initialUnitNameForAccount, setInitialUnitNameForAccount] = useState('');

  // Sidebar hidden state: persisted across sessions
  const [isSidebarHidden, setIsSidebarHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem('elapor_sidebar_hidden') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = useCallback(() => {
    setIsSidebarHidden(prev => {
      const next = !prev;
      try {
        localStorage.setItem('elapor_sidebar_hidden', String(next));
      } catch {}
      return next;
    });
  }, []);

  const navigateTo = useCallback((path: string, options?: { state?: any }) => {
    if (path === '/') {
      setSelectedReport(null);
    }
    navigate(path);
    mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [navigate]);


  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setErrorInfo(null);

    // Listen to units
    const unsubUnits = onSnapshot(collection(db, 'units'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Unit));
      setUnits(data);
    }, (err: any) => {
      if (err.message?.includes('Quota') || err.message?.includes('limit')) console.warn("Units listener quota exceeded");
      else console.error("Units listener failed", err);
    });

    // Listen to expense types
    const unsubExp = onSnapshot(collection(db, 'expense_types'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() as any } as ExpenseType));
      setExpenseTypes(data);
    }, (err: any) => {
      if (err.message?.includes('Quota') || err.message?.includes('limit')) console.warn("Expense types listener quota exceeded");
      else console.error("Expense types listener failed", err);
    });

    // Listen to employees
    const unsubEmp = onSnapshot(collection(db, 'employees'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Employee));
      setEmployees(data);
    }, (err: any) => {
      if (err.message?.includes('Quota') || err.message?.includes('limit')) console.warn("Employees listener quota exceeded");
      else console.error("Employees listener failed", err);
    });

    // Listen to school settings
    const unsubSchool = onSnapshot(doc(db, 'school_settings', 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as SchoolSettings;
        setSchoolSettings({
          schoolName: data.schoolName || 'SMK MUHAMMADIYAH 1 NGADIREJO',
          schoolLogo: data.schoolLogo || '',
          memoHeaderUrl: data.memoHeaderUrl || data.kopHeaderUrl || '',
          kopHeaderUrl: data.kopHeaderUrl || data.memoHeaderUrl || '',
          principalName: data.principalName || '',
          principalNbm: data.principalNbm || '',
          treasurerName: data.treasurerName || '',
          treasurerNbm: data.treasurerNbm || '',
          schoolAddress: data.schoolAddress || 'Jl. Raya Candiroto, Ngaren, Ngadirejo, Temanggung, Jawa Tengah',
          memoCity: data.memoCity || 'Ngadirejo',
          memoApproverName: data.memoApproverName || '',
          memoApproverNbm: data.memoApproverNbm || '',
          memoCheckerName: data.memoCheckerName || '',
          memoCheckerNbm: data.memoCheckerNbm || '',
          memoMakerName: data.memoMakerName || '',
          memoMakerNbm: data.memoMakerNbm || '',
        });
      }
    }, (err: any) => {
      console.warn("School settings listener error", err);
    });

    // Listen to reports
    const q = isAdmin
      ? query(collection(db, 'reports'), orderBy('submittedAt', 'desc'), limit(100))
      : query(collection(db, 'reports'), where('unitName', '==', user.unitName), orderBy('submittedAt', 'desc'), limit(100));

    const unsubReports = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Report));
      setReports(data);
      setLoading(false);
    }, (err: any) => {
      if (err.message?.includes('Quota exceeded') || err.message?.includes('Quota limit exceeded')) {
        console.warn("Reports listener blocked: Quota Exceeded");
        setErrorInfo('Limit kuota harian database tercapai.');
      } else {
        console.error("Reports listener failed", err);
      }
      setLoading(false);
    });

    return () => {
      unsubUnits();
      unsubExp();
      unsubEmp();
      unsubSchool();
      unsubReports();
    };
  }, [user, isAdmin]);

  const handleSaveSchoolSettings = async (data: SchoolSettings) => {
    try {
      await setDoc(doc(db, 'school_settings', 'general'), {
        ...data,
        updatedAt: serverTimestamp(),
        updatedBy: user?.username || 'admin',
      }, { merge: true });
      safeAlert('Pengaturan Sekolah berhasil disimpan!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'school_settings/general');
    }
  };

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
    let printWindow: Window | null = null;
    try {
      printWindow = window.open('', '_blank');
    } catch (e) {
      console.error("Popup blocked during print", e);
    }
    if (!printWindow) {
      safeAlert("Popup printer terblokir oleh browser. Silakan izinkan popup atau buka aplikasi di tab baru untuk melakukan cetak.");
      return;
    }

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
             <p style="margin: 0; font-weight: bold;">Tanggal Pengajuan: ${formatDate(report.submissionDate)}</p>
          </div>
          <table class="rpt-table" style="width:100%; border-collapse:collapse; margin-top:20px;">
            <thead>
                <tr style="background:#f0f0f0;">
                    <th style="border:1px solid #000; padding:6px; width:20%;">Kategori</th>
                    <th style="border:1px solid #000; padding:6px;">Deskripsi</th>
                    <th style="border:1px solid #000; padding:6px; text-align:right; width:25%;">Nominal (Rp)</th>
                </tr>
            </thead>
            <tbody>
                ${(report.proposedDetails || []).map(d => `
                    <tr>
                        <td style="border:1px solid #000; padding:6px; font-size: 9pt;">${d.category}</td>
                        <td style="border:1px solid #000; padding:6px;">${d.description}</td>
                        <td style="border:1px solid #000; padding:6px; text-align:right;">${formatCurrency(d.amount)}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2" style="border:1px solid #000; padding:6px; font-weight:bold; text-align:right;">Total</td>
                    <td style="border:1px solid #000; padding:6px; text-align:right; font-weight:bold;">${formatCurrency(report.amountReceived)}</td>
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
          ${report.includeWakaSignature ? `
            <div style="margin-top: 30px; display: flex; justify-content: center; font-size: 11pt; page-break-inside: avoid;">
              <div style="text-align: center; width: 45%;">
                <p style="margin: 0 0 60px 0; line-height: 1.4;">Mengetahui,<br/>${report.wakaJabatan || 'Waka Ur........................'}</p>
                <p style="margin: 0; font-weight: bold; text-decoration: underline;">${report.wakaName || ''}</p>
                <div style="border-bottom: 1px solid #000; width: 220px; margin: 0 auto;"></div>
              </div>
            </div>
          ` : ''}
          <script>window.print(); setTimeout(() => window.close(), 1000);</script>
        </body>
      </html>
    `;
    try {
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (e) {
      console.error("Failed to write to print window:", e);
      safeAlert("Gagal membuka halaman cetak. Pastikan browser mengaktifkan popup atau buka aplikasi di tab baru.");
    }
  };

  const handlePrintLaporan = (report: Report) => {
    if (!isAdmin && report.status !== ReportStatus.COMPLETED && report.status !== ReportStatus.ARCHIVED) {
        safeAlert("Laporan harus disahkan oleh bendahara terlebih dahulu.");
        return;
    }
    let printWindow: Window | null = null;
    try {
      printWindow = window.open('', '_blank');
    } catch (e) {
      console.error("Popup blocked during print", e);
    }
    if (!printWindow) {
      safeAlert("Popup printer terblokir oleh browser. Silakan izinkan popup atau buka aplikasi di tab baru untuk melakukan cetak.");
      return;
    }

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
              <td>${formatDate(report.submissionDate)}</td>
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
                <th style="width: 20%;">Jenis Pengeluaran</th>
                <th>Deskripsi Pagu Anggaran</th>
                <th style="width: 15%;">Anggaran (Rp)</th>
                <th style="width: 15%;">Realisasi (Rp)</th>
                <th style="width: 15%;">Selisih (Rp)</th>
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
                    <td style="font-size: 9pt;">${p.category}</td>
                    <td>${p.description}</td>
                    <td class="text-right">${formatCurrency(p.amount)}</td>
                    <td class="text-right">${formatCurrency(actualAmount)}</td>
                    <td class="text-right">${formatCurrency(diff)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold; background: #fafafa;">
                <td colspan="3" class="text-right">TOTAL</td>
                <td class="text-right">${formatCurrency(report.amountReceived)}</td>
                <td class="text-right">${formatCurrency(report.totalSpent)}</td>
                <td class="text-right">${formatCurrency((report.amountReceived || 0) - (report.totalSpent || 0))}</td>
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
          ${report.includeWakaSignature ? `
            <div style="margin-top: 30px; display: flex; justify-content: center; font-size: 11pt; page-break-inside: avoid;">
              <div style="text-align: center; width: 45%;">
                <p style="margin: 0 0 60px 0; line-height: 1.4;">Mengetahui,<br/>${report.wakaJabatan || 'Waka Ur........................'}</p>
                <p style="margin: 0; font-weight: bold; text-decoration: underline;">${report.wakaName || ''}</p>
                <div style="border-bottom: 1px solid #000; width: 220px; margin: 0 auto;"></div>
              </div>
            </div>
          ` : ''}

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
                <th style="width: 15%;">No. Bukti</th>
                <th style="width: 12%;">Tanggal</th>
                <th style="width: 18%;">Pagu Anggaran</th>
                <th>Rincian Belanja</th>
                <th style="width: 15%;">Pegawai</th>
                <th style="width: 15%;">Realisasi (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${(report.details || []).map((d, index) => {
                const budgetItem = report.proposedDetails && d.proposedIndex !== undefined ? report.proposedDetails[d.proposedIndex] : null;
                const budgetDesc = budgetItem ? budgetItem.description : 'Tanpa Acuan';
                const isPegawai = budgetItem?.category?.toLowerCase().includes('pegawai') || d.category?.toLowerCase().includes('pegawai');
                const employeeName = isPegawai ? (d.employeeName || 'Belum Ditentukan') : '-';
                return `
                  <tr>
                    <td class="text-center">${index + 1}</td>
                    <td style="font-size: 8pt; font-family: monospace; font-weight: bold;">${d.noBukti || '-'}</td>
                    <td style="font-size: 8pt;">${formatDate(d.date, { dateStyle: 'short' })}</td>
                    <td style="font-size: 8pt;">${budgetDesc}</td>
                    <td style="font-size: 9pt;">${d.description}</td>
                    <td style="font-size: 9pt;">${employeeName}</td>
                    <td class="text-right">${formatCurrency(d.amount)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold; background: #fafafa;">
                <td colspan="5" class="text-right">TOTAL PENGELUARAN</td>
                <td class="text-right">${formatCurrency(report.totalSpent)}</td>
              </tr>
            </tfoot>
          </table>

          ${(() => {
            const hasEmployee = report.proposedDetails?.some(
              b => b.category?.toLowerCase().includes('pegawai')
            ) || false;

            if (!hasEmployee) return '';

            const employeeRecap: { [name: string]: number } = {};
            (report.details || []).forEach(d => {
              const budgetItem = report.proposedDetails && d.proposedIndex !== undefined ? report.proposedDetails[d.proposedIndex] : null;
              const isPegawai = budgetItem?.category?.toLowerCase().includes('pegawai') || d.category?.toLowerCase().includes('pegawai');
              if (isPegawai) {
                const name = d.employeeName || 'Belum Ditentukan';
                employeeRecap[name] = (employeeRecap[name] || 0) + (d.amount || 0);
              }
            });

            return `
              <div style="margin-top: 30px; page-break-inside: avoid;">
                <h3 style="margin: 0 0 10px 0; font-size: 13pt; text-transform: uppercase;">Rekapitulasi Penerimaan Biaya Pegawai</h3>
                <table class="rpt-table" style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: #f5f5f5;">
                      <th style="width: 10%; text-align: center;">No</th>
                      <th style="text-align: left;">Nama Pegawai</th>
                      <th style="width: 30%; text-align: right;">Total Penerimaan (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${Object.keys(employeeRecap).length > 0 ? 
                      Object.entries(employeeRecap).map(([name, sum], idx) => `
                        <tr>
                          <td class="text-center">${idx + 1}</td>
                          <td>${name}</td>
                          <td class="text-right">${formatCurrency(sum)}</td>
                        </tr>
                      `).join('') 
                      : `<tr><td colspan="3" class="text-center" style="font-style: italic; padding: 12px;">Tidak ada realisasi biaya pegawai</td></tr>`
                    }
                  </tbody>
                  ${Object.keys(employeeRecap).length > 0 ? `
                    <tfoot>
                      <tr style="font-weight: bold; background: #fafafa;">
                        <td colspan="2" class="text-right">TOTAL PENGELUARAN PEGAWAI</td>
                        <td class="text-right">${formatCurrency(Object.values(employeeRecap).reduce((a, b) => a + b, 0))}</td>
                      </tr>
                    </tfoot>
                  ` : ''}
                </table>
              </div>
            `;
          })()}

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
          ${report.includeWakaSignature ? `
            <div style="margin-top: 30px; display: flex; justify-content: center; font-size: 11pt; page-break-inside: avoid;">
              <div style="text-align: center; width: 45%;">
                <p style="margin: 0 0 60px 0; line-height: 1.4;">Mengetahui,<br/>${report.wakaJabatan || 'Waka Ur........................'}</p>
                <p style="margin: 0; font-weight: bold; text-decoration: underline;">${report.wakaName || ''}</p>
                <div style="border-bottom: 1px solid #000; width: 220px; margin: 0 auto;"></div>
              </div>
            </div>
          ` : ''}

          <script>window.print(); setTimeout(() => window.close(), 1000);</script>
        </body>
      </html>
    `;
    try {
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (e) {
      console.error("Failed to write to print window:", e);
      safeAlert("Gagal membuka halaman cetak. Pastikan browser mengaktifkan popup atau buka aplikasi di tab baru.");
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: ReportStatus, notes?: string, customDate?: string) => {
    try {
      const updatePayload: any = { 
        status: newStatus, 
        treasurerNotes: notes !== undefined ? notes : '',
        updatedAt: serverTimestamp() 
      };
      if (newStatus === ReportStatus.BUDGET_APPROVED) {
        updatePayload.approvedAt = serverTimestamp();
        updatePayload.approvalDate = customDate || new Date().toISOString().split('T')[0];
        updatePayload.completedAt = null;
        updatePayload.completedDate = null;
      } else if (newStatus === ReportStatus.REPORTING) {
        updatePayload.reportingInstructedAt = serverTimestamp();
        updatePayload.reportingInstructedDate = customDate || new Date().toISOString().split('T')[0];
        updatePayload.completedAt = null;
        updatePayload.completedDate = null;
      } else if (newStatus === ReportStatus.COMPLETED || newStatus === ReportStatus.ARCHIVED) {
        updatePayload.completedAt = serverTimestamp();
        updatePayload.completedDate = customDate || new Date().toISOString().split('T')[0];
      }
      await setDoc(doc(db, 'reports', id), updatePayload, { merge: true });
      await refreshReports();

      // Kirim Notifikasi WhatsApp Otomatis ke Pengaju via Fonnte.com
      const targetReport = reports.find(r => r.id === id);
      if (targetReport) {
        const mergedReport: Report = {
          ...targetReport,
          status: newStatus,
          treasurerNotes: notes !== undefined ? notes : targetReport.treasurerNotes,
          reportingInstructedDate: newStatus === ReportStatus.REPORTING 
            ? (customDate || new Date().toISOString().split('T')[0]) 
            : targetReport.reportingInstructedDate
        };
        sendReportStatusNotification(mergedReport, newStatus, notes, db).catch(err => {
          console.warn('WhatsApp notification delivery error:', err);
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${id}`);
    }
  };

  const handleDeleteReport = async (report: Report) => {
    if (safeConfirm(`Hapus kegiatan ${report.activityName}?`)) {
      try {
        await deleteDoc(doc(db, 'reports', report.id!));
        await refreshReports();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `reports/${report.id}`);
      }
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-natural-bg font-sans selection:bg-natural-primary/10">
      {/* Mobile backdrop overlay when sidebar is open on small screens */}
      {!isSidebarHidden && (
        <div 
          onClick={toggleSidebar}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar: Fixed, Non-scrolling with the main page; User & Logout pinned at bottom-left */}
      <aside 
        className={`h-screen bg-natural-bg border-r border-natural-border flex flex-col flex-shrink-0 z-40 lg:z-30 transition-all duration-300 ease-in-out select-none ${
          isSidebarHidden 
            ? 'w-0 -translate-x-full border-r-0 opacity-0 pointer-events-none p-0 overflow-hidden' 
            : 'w-72 lg:w-80 translate-x-0 opacity-100 fixed lg:static inset-y-0 left-0 shadow-2xl lg:shadow-none'
        }`}
      >
        {/* Sidebar Header with Brand and Sembunyikan/Hide Button */}
        <div className="p-6 pb-4 border-b border-natural-border/60 flex items-center justify-between flex-shrink-0">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-serif italic text-natural-primary tracking-tighter">E-Lapor.</h1>
            <p className="text-[10px] font-bold text-natural-secondary uppercase tracking-[0.1em]">SMK MUH 1 NGADIREJO</p>
          </div>
          <button
            onClick={toggleSidebar}
            title="Sembunyikan Navigasi"
            className="p-2 rounded-xl text-natural-secondary hover:text-natural-primary hover:bg-natural-primary/5 transition-colors border border-transparent hover:border-natural-border cursor-pointer"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Navigation Menu (scrolls independently if needed) */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1.5 custom-scrollbar min-h-0">
          <button 
            onClick={() => { navigateTo('/'); setSelectedReport(null); }}
            className={`w-full text-left px-5 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${location.pathname === '/' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
          <button 
            onClick={() => { navigateTo('/anggaran'); setSelectedUnitFolder(null); setSelectedReport(null); }}
            className={`w-full text-left px-5 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${location.pathname === '/anggaran' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
          >
            <FileText className="w-4 h-4" />
            Anggaran
          </button>
          <button 
            onClick={() => { navigateTo('/laporan'); setSelectedUnitFolder(null); setSelectedReport(null); }}
            className={`w-full text-left px-5 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${location.pathname === '/laporan' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
          >
            <FileText className="w-4 h-4" />
            Laporan
          </button>
          <button 
            onClick={() => { navigateTo('/arsip'); setSelectedUnitFolder(null); setSelectedReport(null); }}
            className={`w-full text-left px-5 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${location.pathname === '/arsip' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
          >
            <Lock className="w-4 h-4" />
            Arsip Laporan
          </button>
          {isAdmin && (
            <>
              <button 
                onClick={() => { navigateTo('/buku-kas-keluar'); setSelectedUnitFolder(null); setSelectedReport(null); }}
                className={`w-full text-left px-5 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${location.pathname === '/buku-kas-keluar' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
              >
                <BookOpen className="w-4 h-4" />
                Buku Kas (BKK)
              </button>

              <button 
                onClick={() => { navigateTo('/memo-budget'); setSelectedUnitFolder(null); setSelectedReport(null); }}
                className={`w-full text-left px-5 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${location.pathname === '/memo-budget' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
              >
                <FileCheck2 className="w-4 h-4" />
                Memo Budget Mingguan
              </button>

              <button 
                onClick={() => { navigateTo('/memorial-kas-tunai'); setSelectedUnitFolder(null); setSelectedReport(null); }}
                className={`w-full text-left px-5 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${location.pathname === '/memorial-kas-tunai' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Memorial Kas Tunai
              </button>

              <div className="h-px bg-natural-border/50 my-3 mx-4" />
              <button 
                onClick={() => navigateTo('/settings')}
                className={`w-full text-left px-5 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 ${location.pathname.startsWith('/settings') || location.pathname === '/users' || location.pathname === '/units' ? 'bg-natural-primary text-white shadow-lg' : 'hover:bg-white text-natural-secondary'}`}
              >
                <Settings className="w-4 h-4" />
                Pengaturan
              </button>
            </>
          )}
        </div>

        {/* User Info & Logout: Pinned at bottom left */}
        <div className="flex-shrink-0 border-t border-natural-border px-6 py-4 bg-natural-bg mt-auto">
          <div className="flex items-center gap-3.5 group">
            <div className="w-10 h-10 rounded-full bg-natural-primary/10 flex items-center justify-center text-natural-primary font-serif italic text-xl border border-natural-primary/20 flex-shrink-0">
              {user?.displayName?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-natural-primary uppercase tracking-wider truncate mb-1" title={user?.displayName}>
                {user?.displayName}
              </p>
              <button 
                onClick={logout} 
                className="text-[9px] font-bold text-natural-secondary uppercase tracking-[0.2em] hover:text-red-500 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                Keluar Sistem <LogOut className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Area: Independent Column with Top Header and Scrollable Body */}
      <div className="flex-1 h-screen flex flex-col min-w-0 overflow-hidden">
        {/* Navigation Top Header Bar */}
        <header className="flex-shrink-0 bg-natural-bg/95 backdrop-blur-xs border-b border-natural-border/60 px-6 py-3.5 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              title={isSidebarHidden ? "Tampilkan Navigasi" : "Sembunyikan Navigasi"}
              className="p-2 rounded-xl bg-white border border-natural-border text-natural-primary hover:bg-natural-primary hover:text-white shadow-xs transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer active:scale-95"
            >
              {isSidebarHidden ? (
                <>
                  <PanelLeftOpen className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Buka Navigasi</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4" />
                  <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest">Sembunyikan</span>
                </>
              )}
            </button>
            <div className="h-4 w-px bg-natural-border/60 mx-1 hidden sm:block" />
            <span className="text-xs font-serif italic text-natural-secondary font-medium hidden md:inline truncate">
              Sistem Pertanggungjawaban Keuangan SMK MUH 1 NGADIREJO
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] font-bold text-natural-primary uppercase tracking-widest block leading-tight">
                {user?.unitName || user?.displayName}
              </span>
              <span className="text-[9px] text-natural-secondary font-mono">
                {isAdmin ? 'Administrator' : 'Unit Kerja'}
              </span>
            </div>
            {isSidebarHidden && (
              <button
                onClick={logout}
                title="Keluar Sistem"
                className="p-2 rounded-xl bg-white border border-natural-border text-natural-secondary hover:text-red-600 hover:border-red-200 transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Main Viewport */}
        <main ref={mainContentRef} className="flex-1 overflow-y-auto px-6 lg:px-10 py-8 flex flex-col custom-scrollbar">
          {errorInfo && (
            <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-sm flex-shrink-0">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="font-medium">{errorInfo}</p>
            </div>
          )}
          <div className="flex-1">
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                          <div className="flex flex-wrap gap-3">
                            <button 
                              onClick={() => navigateTo('/create')}
                              className="text-[10px] font-bold uppercase tracking-widest text-natural-primary bg-natural-primary/5 px-4 py-2 rounded-full border border-natural-primary/20 hover:bg-natural-primary hover:text-white transition-all"
                            >
                              {isAdmin ? 'Terbitkan Anggaran Baru' : 'Ajukan Anggaran Baru'}
                            </button>
                            {isAdmin && (
                              <button 
                                onClick={() => navigateTo('/buku-kas-keluar')}
                                className="text-[10px] font-bold uppercase tracking-widest text-natural-primary bg-white px-4 py-2 rounded-full border border-natural-border hover:border-natural-primary hover:bg-natural-bg/50 transition-all flex items-center gap-1.5 shadow-xs"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                Buka Buku Kas (BKK)
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col justify-center gap-4 bg-natural-input p-6 rounded-3xl border border-natural-border/50">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-natural-secondary font-bold">Status Koneksi</span>
                            <span className="font-mono text-green-600 font-bold uppercase tracking-widest text-[9px]">Terhubung (Live)</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-natural-secondary font-bold">Laporan Pending</span>
                            <span className="font-mono font-bold text-amber-600">
                              {reports.filter(r => 
                                r.status === ReportStatus.BUDGET_PROPOSAL || 
                                (r.status === ReportStatus.REVISION && (!r.details || r.details.length === 0))
                              ).length} Kegiatan
                            </span>
                          </div>
                        </div>
                    </div>
                  </div>
                </motion.div>
              } />

              <Route path="/anggaran" element={
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                          onClick={() => { setSelectedReport(null); navigateTo('/create'); }}
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
                    onSelect={(r) => { setSelectedReport(r); navigateTo('/detail'); }} 
                    onPrint={handlePrintAnggaran}
                    onDelete={handleDeleteReport}
                  />
                </motion.div>
              } />

              <Route path="/laporan" element={
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                    allowedStatuses={[ReportStatus.REPORTING, ReportStatus.COMPLETED, ReportStatus.REVISION, ReportStatus.INCOMPLETE]}
                    onSelect={(r) => { setSelectedReport(r); navigateTo('/detail'); }} 
                    onPrint={handlePrintLaporan}
                    onPrintRAB={handlePrintAnggaran}
                    onDelete={handleDeleteReport}
                  />
                </motion.div>
              } />

              <Route path="/arsip" element={
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                      <div className="flex items-center gap-4">
                        {isAdmin && selectedUnitFolder && (
                          <button 
                            onClick={() => setSelectedUnitFolder(null)}
                            className="p-2 hover:bg-white rounded-full transition-colors border border-natural-border bg-white shadow-sm"
                          >
                            <ArrowLeft className="w-5 h-5 text-natural-primary" />
                          </button>
                        )}
                        <div>
                          <h2 className="text-4xl font-serif italic text-natural-primary tracking-tight">
                            {isAdmin && selectedUnitFolder ? `Arsip: ${selectedUnitFolder}` : 'Arsip Laporan'}
                          </h2>
                          <p className="text-natural-secondary text-sm uppercase tracking-widest font-light mt-2">Kumpulan laporan yang sudah selesai</p>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={refreshReports}
                      disabled={loading}
                      className="p-3 bg-natural-input border border-natural-border rounded-full hover:bg-white transition-all disabled:opacity-50"
                    >
                      <RotateCw className={`w-5 h-5 text-natural-secondary ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {isAdmin && !selectedUnitFolder ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {units.map(unit => {
                        const unitReportsCount = reports.filter(r => r.unitName === unit.name && (r.status === ReportStatus.COMPLETED || r.status === ReportStatus.ARCHIVED)).length;
                        return (
                          <motion.div 
                            key={unit.id}
                            whileHover={{ y: -5, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                            onClick={() => setSelectedUnitFolder(unit.name)}
                            className="bg-white p-8 rounded-[32px] border border-natural-border shadow-sm cursor-pointer group transition-all"
                          >
                            <div className="w-14 h-14 bg-natural-primary/5 rounded-2xl flex items-center justify-center text-natural-primary mb-6 group-hover:bg-natural-primary group-hover:text-white transition-all">
                              <Folder className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-serif italic text-natural-primary mb-2">{unit.name}</h3>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-natural-secondary uppercase tracking-widest">{unitReportsCount} Laporan</span>
                              <ChevronRight className="w-4 h-4 text-natural-primary" />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <ReportTable 
                      reports={isAdmin && selectedUnitFolder ? reports.filter(r => r.unitName === selectedUnitFolder) : reports} 
                      isAdmin={isAdmin} 
                      allowedStatuses={[ReportStatus.COMPLETED, ReportStatus.ARCHIVED]}
                      onSelect={(r) => { setSelectedReport(r); navigateTo('/detail'); }} 
                      onPrint={handlePrintLaporan}
                      onPrintRAB={handlePrintAnggaran}
                      onDelete={handleDeleteReport}
                    />
                  )}
                </motion.div>
              } />

              <Route path="/detail" element={
                selectedReport ? (
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
                    onBack={() => { navigate(-1); setSelectedReport(null); }}
                    onEdit={() => navigateTo('/create')}
                  />
                ) : <Navigate to="/" replace />
              } />

              <Route path="/create" element={
                <ReportForm 
                  user={user!} 
                  editReport={selectedReport || undefined}
                  units={units}
                  expenseTypes={expenseTypes}
                  employees={employees}
                  onPrintRAB={handlePrintAnggaran}
                  onCancel={() => { navigate(-1); setSelectedReport(null); }} 
                  onSuccess={() => { refreshReports(); navigate(-1); setSelectedReport(null); }} 
                />
              } />

              <Route path="/users" element={
                isAdmin ? (
                  <motion.div key="users_settings_tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <SettingsPage
                      activeSubTab="users"
                      schoolSettings={schoolSettings}
                      onSaveSchoolSettings={handleSaveSchoolSettings}
                      expenseTypes={expenseTypes}
                      employees={employees}
                      units={units}
                      db={db}
                      userEmail={user?.username || 'admin'}
                    />
                  </motion.div>
                ) : <Navigate to="/" replace />
              } />

              <Route path="/units" element={
                isAdmin ? (
                  <motion.div key="units_settings_tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <SettingsPage
                      activeSubTab="units"
                      schoolSettings={schoolSettings}
                      onSaveSchoolSettings={handleSaveSchoolSettings}
                      expenseTypes={expenseTypes}
                      employees={employees}
                      units={units}
                      db={db}
                      userEmail={user?.username || 'admin'}
                    />
                  </motion.div>
                ) : <Navigate to="/" replace />
              } />

              <Route path="/settings" element={
                isAdmin ? (
                  <motion.div key="settings_school" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <SettingsPage
                      activeSubTab="school"
                      schoolSettings={schoolSettings}
                      onSaveSchoolSettings={handleSaveSchoolSettings}
                      expenseTypes={expenseTypes}
                      employees={employees}
                      units={units}
                      db={db}
                      userEmail={user?.username || 'admin'}
                    />
                  </motion.div>
                ) : <Navigate to="/" replace />
              } />

              <Route path="/settings/school" element={
                isAdmin ? (
                  <motion.div key="settings_school_tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <SettingsPage
                      activeSubTab="school"
                      schoolSettings={schoolSettings}
                      onSaveSchoolSettings={handleSaveSchoolSettings}
                      expenseTypes={expenseTypes}
                      employees={employees}
                      units={units}
                      db={db}
                      userEmail={user?.username || 'admin'}
                    />
                  </motion.div>
                ) : <Navigate to="/" replace />
              } />

              <Route path="/settings/users" element={
                isAdmin ? (
                  <motion.div key="settings_users_tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <SettingsPage
                      activeSubTab="users"
                      schoolSettings={schoolSettings}
                      onSaveSchoolSettings={handleSaveSchoolSettings}
                      expenseTypes={expenseTypes}
                      employees={employees}
                      units={units}
                      db={db}
                      userEmail={user?.username || 'admin'}
                    />
                  </motion.div>
                ) : <Navigate to="/" replace />
              } />

              <Route path="/settings/units" element={
                isAdmin ? (
                  <motion.div key="settings_units_tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <SettingsPage
                      activeSubTab="units"
                      schoolSettings={schoolSettings}
                      onSaveSchoolSettings={handleSaveSchoolSettings}
                      expenseTypes={expenseTypes}
                      employees={employees}
                      units={units}
                      db={db}
                      userEmail={user?.username || 'admin'}
                    />
                  </motion.div>
                ) : <Navigate to="/" replace />
              } />

              <Route path="/settings/expenses" element={
                isAdmin ? (
                  <motion.div key="settings_expenses_tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <SettingsPage
                      activeSubTab="expenses"
                      schoolSettings={schoolSettings}
                      onSaveSchoolSettings={handleSaveSchoolSettings}
                      expenseTypes={expenseTypes}
                      employees={employees}
                      units={units}
                      db={db}
                      userEmail={user?.username || 'admin'}
                    />
                  </motion.div>
                ) : <Navigate to="/" replace />
              } />

              <Route path="/settings/employees" element={
                isAdmin ? (
                  <motion.div key="settings_employees_tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <SettingsPage
                      activeSubTab="employees"
                      schoolSettings={schoolSettings}
                      onSaveSchoolSettings={handleSaveSchoolSettings}
                      expenseTypes={expenseTypes}
                      employees={employees}
                      units={units}
                      db={db}
                      userEmail={user?.username || 'admin'}
                    />
                  </motion.div>
                ) : <Navigate to="/" replace />
              } />

              <Route path="/settings/whatsapp" element={
                isAdmin ? (
                  <motion.div key="settings_whatsapp_tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <SettingsPage
                      activeSubTab="whatsapp"
                      schoolSettings={schoolSettings}
                      onSaveSchoolSettings={handleSaveSchoolSettings}
                      expenseTypes={expenseTypes}
                      employees={employees}
                      units={units}
                      db={db}
                      userEmail={user?.username || 'admin'}
                    />
                  </motion.div>
                ) : <Navigate to="/" replace />
              } />

              <Route path="/buku-kas-keluar" element={
                isAdmin ? (
                  <motion.div key="buku_kas_keluar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <BukuKasKeluar
                      reports={reports}
                      units={units}
                      expenseTypes={expenseTypes}
                      loading={loading}
                      onRefresh={refreshReports}
                      onSelectReport={(r) => { setSelectedReport(r); navigateTo('/detail'); }}
                      schoolSettings={schoolSettings}
                    />
                  </motion.div>
                ) : <Navigate to="/" replace />
              } />

              <Route path="/memo-budget" element={
                isAdmin ? (
                  <motion.div key="memo_budget_page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <MemoBudgetPage
                      db={db}
                      schoolSettings={schoolSettings}
                      reports={reports}
                      userEmail={user?.username || 'admin'}
                    />
                  </motion.div>
                ) : <Navigate to="/" replace />
              } />

              <Route path="/memorial-kas-tunai" element={
                isAdmin ? (
                  <motion.div key="memorial_kas_tunai_page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <MemorialKasTunaiPage
                      db={db}
                      schoolSettings={schoolSettings}
                      reports={reports}
                      userEmail={user?.username || 'admin'}
                    />
                  </motion.div>
                ) : <Navigate to="/" replace />
              } />
            </Routes>
          </AnimatePresence>
          </div>

          {/* Integrated Footer inside the main scrollable view */}
          <footer className="mt-12 pt-6 pb-4 text-[10px] text-natural-secondary/70 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-natural-border/60 italic flex-shrink-0">
            <span>SISTEM INFORMASI KEUANGAN MUHIJO • VER 2.0</span>
            <span>{formatDate(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const login = useCallback(async (username: string, pass: string): Promise<boolean> => {
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
        const now = String(Date.now());
        setUser(appUser);
        setIsAdmin(userData.role === 'admin');

        // Store session alive indicator in sessionStorage (cleared when browser/tab closes)
        safeSessionStorage.setItem('session_alive', 'true');
        safeSessionStorage.setItem('auth_session', JSON.stringify(appUser));
        safeSessionStorage.setItem('user_role', userData.role);
        safeSessionStorage.setItem('last_active_time', now);

        // Store in localStorage as backup for active session
        safeLocalStorage.setItem('auth_session', JSON.stringify(appUser));
        safeLocalStorage.setItem('user_role', userData.role);
        safeLocalStorage.setItem('last_active_time', now);
        return true;
      }
    } catch (err: any) {
      const msg = err.message || String(err);
      if (msg.includes('Quota exceeded') || msg.includes('Quota limit exceeded')) {
        console.warn("Login blocked: Quota Exceeded");
        setQuotaExceeded(true);
        setErrorMessage('Database sedang limit (Quota Exceeded). Tidak dapat memproses login saat ini.');
      } else {
        console.error("Login failed", err);
      }
    }
    return false;
  }, []);

  const logout = useCallback((isTimeout = false) => {
    setUser(null);
    setIsAdmin(false);
    safeLocalStorage.removeItem('auth_session');
    safeLocalStorage.removeItem('user_role');
    safeLocalStorage.removeItem('last_active_time');
    safeSessionStorage.removeItem('auth_session');
    safeSessionStorage.removeItem('user_role');
    safeSessionStorage.removeItem('session_alive');
    safeSessionStorage.removeItem('last_active_time');
    if (isTimeout) {
      safeAlert('Sesi Anda telah berakhir karena tidak ada aktivitas selama 90 menit. Silakan login kembali.');
    }
  }, []);

  useEffect(() => {
    const INACTIVITY_LIMIT_MS = 90 * 60 * 1000; // 90 minutes
    const sessionAlive = safeSessionStorage.getItem('session_alive');
    const sessionData = safeLocalStorage.getItem('auth_session') || safeSessionStorage.getItem('auth_session');
    const role = safeLocalStorage.getItem('user_role') || safeSessionStorage.getItem('user_role');
    const lastActiveStr = safeLocalStorage.getItem('last_active_time') || safeSessionStorage.getItem('last_active_time');
    const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : 0;
    const isExpired = lastActive > 0 && (Date.now() - lastActive >= INACTIVITY_LIMIT_MS);

    // If browser was completely closed (sessionAlive missing) or session expired:
    if (!sessionAlive || isExpired) {
      safeLocalStorage.removeItem('auth_session');
      safeLocalStorage.removeItem('user_role');
      safeLocalStorage.removeItem('last_active_time');
      safeSessionStorage.removeItem('auth_session');
      safeSessionStorage.removeItem('user_role');
      safeSessionStorage.removeItem('session_alive');
      safeSessionStorage.removeItem('last_active_time');
      setUser(null);
      setIsAdmin(false);
    } else if (sessionData) {
      try {
        const u = JSON.parse(sessionData) as AppUser;
        setUser(u);
        setIsAdmin(role === 'admin');
        const now = String(Date.now());
        safeLocalStorage.setItem('last_active_time', now);
        safeSessionStorage.setItem('last_active_time', now);
        safeSessionStorage.setItem('session_alive', 'true');
      } catch (err) {
        safeLocalStorage.removeItem('auth_session');
        safeLocalStorage.removeItem('user_role');
        safeLocalStorage.removeItem('last_active_time');
        safeSessionStorage.removeItem('auth_session');
        safeSessionStorage.removeItem('user_role');
        safeSessionStorage.removeItem('session_alive');
      }
    }
    setLoading(false);

    // Bootstrap units and users ONLY IF not done before in this browser
    const bootstrap = async () => {
      if (safeLocalStorage.getItem('db_bootstrapped_v2')) return;

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
        safeLocalStorage.setItem('db_bootstrapped_v2', 'true');
      } catch (e: any) {
        const errorMessage = e.message || String(e);
        if (errorMessage.includes('Quota exceeded') || errorMessage.includes('Quota limit exceeded')) {
          console.warn("Bootstrap blocked: Quota Exceeded");
          setQuotaExceeded(true);
          try {
            const parsed = JSON.parse(errorMessage);
            setErrorMessage(parsed.error || errorMessage);
          } catch {
            setErrorMessage('Limit kuota harian database telah tercapai. Mohon coba lagi besok.');
          }
        } else {
          console.error("Bootstrap failed", e);
        }
      }
    };
    bootstrap();
  }, []);

  // 90-Minute Inactivity Auto-Logout with robust activity listening & visibility checking
  useEffect(() => {
    if (!user) return;

    const INACTIVITY_LIMIT_MS = 90 * 60 * 1000; // 90 minutes
    let lastThrottle = 0;

    const updateActivity = () => {
      const now = Date.now();
      if (now - lastThrottle > 3000) {
        lastThrottle = now;
        const nowStr = String(now);
        safeLocalStorage.setItem('last_active_time', nowStr);
        safeSessionStorage.setItem('last_active_time', nowStr);
      }
    };

    const checkInactivity = () => {
      const lastActiveStr = safeLocalStorage.getItem('last_active_time') || safeSessionStorage.getItem('last_active_time');
      const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : Date.now();
      if (Date.now() - lastActive >= INACTIVITY_LIMIT_MS) {
        logout(true);
      }
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'keyup', 'scroll', 'touchstart', 'pointerdown', 'click', 'wheel', 'input'];
    activityEvents.forEach(evt => {
      window.addEventListener(evt, updateActivity, { passive: true });
    });

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
        updateActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    const checkInterval = setInterval(checkInactivity, 15000); // Check every 15 seconds

    return () => {
      activityEvents.forEach(evt => {
        window.removeEventListener(evt, updateActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      clearInterval(checkInterval);
    };
  }, [user, logout]);

  const contextValue = useMemo(() => ({ user, isAdmin, loading, login, logout }), [user, isAdmin, loading, login, logout]);

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

  return (
    <ThemeProvider>
      <HashRouter>
        <AuthContext.Provider value={contextValue}>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </AuthContext.Provider>
      </HashRouter>
    </ThemeProvider>
  );
}

function AppContent() {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <LoadingScreen />;
  
  return (
    <Routes>
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" replace />} />
      <Route 
        path="/*" 
        element={
          user ? <MainDashboard /> : <Navigate to="/login" replace />
        } 
      />
    </Routes>
  );
}
