import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Palette, Check, Sparkles, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ThemeOption {
  id: string;
  name: string;
  subtitle: string;
  desc: string;
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  accentBadge: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'emerald',
    name: 'Hijau Zamrud',
    subtitle: 'Tema Standar Muhammadiyah',
    desc: 'Nuansa hijau Islami yang sejuk, resmi & penuh kehormatan sekolah madrasah.',
    primaryColor: '#064e3b',
    secondaryColor: '#047857',
    bgColor: '#f2f7f4',
    borderColor: '#d1fae5',
    textColor: '#0f291e',
    accentBadge: 'Default / Resmi',
  },
  {
    id: 'navy',
    name: 'Biru Eksekutif',
    subtitle: 'Formal Institusional',
    desc: 'Biru tua klasik, terpercaya, tenang & berwibawa khas administrasi keuangan profesional.',
    primaryColor: '#0f3a5f',
    secondaryColor: '#334e68',
    bgColor: '#f0f4f8',
    borderColor: '#d9e2ec',
    textColor: '#102a43',
    accentBadge: 'Institusi',
  },
  {
    id: 'indigo',
    name: 'Royal Indigo',
    subtitle: 'Modern & Berkelas',
    desc: 'Nuansa ungu indigo digital, prestisius, modern dan elegan dengan estetika tinggi.',
    primaryColor: '#1e1b4b',
    secondaryColor: '#4338ca',
    bgColor: '#f5f7fb',
    borderColor: '#e0e7ff',
    textColor: '#0f172a',
    accentBadge: 'Elegan',
  },
  {
    id: 'teal',
    name: 'Toska Segar',
    subtitle: 'Dinamis & Kontras Tinggi',
    desc: 'Perpaduan toska cerah yang bersih, nyaman dipandang, dan kontras tajam.',
    primaryColor: '#115e59',
    secondaryColor: '#0d9488',
    bgColor: '#f0fdfa',
    borderColor: '#ccfbf1',
    textColor: '#134e4a',
    accentBadge: 'Segar',
  },
  {
    id: 'slate',
    name: 'Slate Minimalis',
    subtitle: 'Monokrom Kontemporer',
    desc: 'Estetika abu-abu netral, modern minimalis, fokus data tanpa distraksi visual.',
    primaryColor: '#0f172a',
    secondaryColor: '#475569',
    bgColor: '#f8fafc',
    borderColor: '#e2e8f0',
    textColor: '#020617',
    accentBadge: 'Minimalis',
  },
  {
    id: 'maroon',
    name: 'Marun Prestisius',
    subtitle: 'Hangat & Berkarakter',
    desc: 'Merah marun mewah, elegan dan tegas, memberikan kesan eksklusif dan mantap.',
    primaryColor: '#831843',
    secondaryColor: '#be185d',
    bgColor: '#fdf2f4',
    borderColor: '#fce7f3',
    textColor: '#500724',
    accentBadge: 'Prestisius',
  },
  {
    id: 'amber',
    name: 'Surya Kencana',
    subtitle: 'Emas Surya Muhammadiyah',
    desc: 'Terinspirasi sinar matahari Muhammadiyah, bernuansa emas hangat, ramah & optimis.',
    primaryColor: '#78350f',
    secondaryColor: '#b45309',
    bgColor: '#fffdf5',
    borderColor: '#fef3c7',
    textColor: '#451a03',
    accentBadge: 'Surya Emas',
  },
  {
    id: 'sky',
    name: 'Biru Langit',
    subtitle: 'Lapang & Modern',
    desc: 'Biru muda segar bagai langit cerah, menghadirkan suasana kerja yang lapang dan bersahabat.',
    primaryColor: '#0369a1',
    secondaryColor: '#0284c7',
    bgColor: '#f0f9ff',
    borderColor: '#e0f2fe',
    textColor: '#0c4a6e',
    accentBadge: 'Dinamis',
  },
  {
    id: 'earth',
    name: 'Cokelat Klasik',
    subtitle: 'Warm Earth & Vintage',
    desc: 'Nuansa kayu jati dan bumi hangat, menenangkan, vintage dan berkarakter matang.',
    primaryColor: '#451a03',
    secondaryColor: '#78350f',
    bgColor: '#faf7f5',
    borderColor: '#f3ece7',
    textColor: '#291205',
    accentBadge: 'Warm Klasik',
  },
];

interface ThemeContextType {
  theme: string;
  setTheme: (t: string) => void;
  themes: ThemeOption[];
  currentTheme: ThemeOption;
  isThemeModalOpen: boolean;
  setIsThemeModalOpen: (open: boolean) => void;
}

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, val: string): void => {
    try {
      localStorage.setItem(key, val);
    } catch {}
  },
};

export const ThemeContext = createContext<ThemeContextType>({
  theme: 'emerald',
  setTheme: () => {},
  themes: THEME_OPTIONS,
  currentTheme: THEME_OPTIONS[0],
  isThemeModalOpen: false,
  setIsThemeModalOpen: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<string>(() => {
    return safeStorage.getItem('app_theme') || 'emerald';
  });
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  const setTheme = useCallback((newTheme: string) => {
    setThemeState(newTheme);
    safeStorage.setItem('app_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const currentTheme = useMemo(() => {
    return THEME_OPTIONS.find(t => t.id === theme) || THEME_OPTIONS[0];
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    setTheme,
    themes: THEME_OPTIONS,
    currentTheme,
    isThemeModalOpen,
    setIsThemeModalOpen,
  }), [theme, setTheme, currentTheme, isThemeModalOpen]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Compact Theme Button / Dropdown for Header & Login
export const ThemeSelector = ({
  className = '',
  dropUp = false,
  lightMode = false,
  openModalOnClick = false,
}: {
  className?: string;
  dropUp?: boolean;
  lightMode?: boolean;
  openModalOnClick?: boolean;
}) => {
  const { theme, setTheme, themes, currentTheme, setIsThemeModalOpen } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = () => {
    if (openModalOnClick) {
      setIsThemeModalOpen(true);
    } else {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl transition-all text-xs font-semibold border shadow-2xs cursor-pointer active:scale-95 ${
          lightMode
            ? 'bg-white hover:bg-natural-bg/60 text-natural-primary border-natural-border hover:border-natural-primary/30 shadow-xs'
            : 'bg-white/10 hover:bg-white/20 text-white border-white/25 hover:border-white/40 backdrop-blur-xs'
        }`}
        title="Ubah Tema & Tampilan Keseluruhan Aplikasi"
      >
        <div className="flex -space-x-1 shrink-0">
          <span
            className="w-3.5 h-3.5 rounded-full border border-white/80 shadow-2xs"
            style={{ backgroundColor: currentTheme.primaryColor }}
          />
          <span
            className="w-3.5 h-3.5 rounded-full border border-white/80 shadow-2xs"
            style={{ backgroundColor: currentTheme.secondaryColor }}
          />
        </div>
        <span className="font-sans text-xs font-bold tracking-wide">
          {currentTheme.name}
        </span>
        <Palette className="w-3.5 h-3.5 opacity-75" />
      </button>

      {!openModalOnClick && (
        <AnimatePresence>
          {isOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: dropUp ? 10 : -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: dropUp ? 10 : -10 }}
                className={`absolute right-0 ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'} w-72 bg-white text-slate-800 rounded-2xl shadow-2xl border border-natural-border p-3 z-50 overflow-hidden`}
              >
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-natural-border/60 mb-2">
                  <span className="text-[11px] font-bold text-natural-text uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-natural-primary" /> Pilih Tema Warna
                  </span>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setIsThemeModalOpen(true);
                    }}
                    className="text-[10px] text-natural-secondary hover:text-natural-primary underline cursor-pointer"
                  >
                    Buka Detail
                  </button>
                </div>
                <div className="space-y-1 max-h-80 overflow-y-auto custom-scrollbar pr-0.5">
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
                        className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
                          isActive
                            ? 'bg-natural-bg font-semibold border border-natural-primary/25'
                            : 'hover:bg-natural-bg/50 border border-transparent'
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
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs text-natural-text font-bold truncate leading-snug">{t.name}</p>
                              {isActive && (
                                <span className="text-[8px] px-1 py-0.2 bg-natural-primary/10 text-natural-primary rounded font-bold uppercase">
                                  Aktif
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-natural-secondary/80 font-normal truncate leading-tight">{t.subtitle}</p>
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
      )}
    </div>
  );
};

// Full-Featured Interactive Theme Modal
export const ThemeModal = () => {
  const { theme, setTheme, themes, isThemeModalOpen, setIsThemeModalOpen } = useTheme();

  if (!isThemeModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-[32px] border border-natural-border shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-natural-border/60 flex items-center justify-between flex-shrink-0 bg-natural-bg/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-natural-primary text-white flex items-center justify-center shadow-sm">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-serif italic text-natural-primary font-bold">Pilih Tema & Tampilan Keseluruhan</h2>
              <p className="text-xs text-natural-secondary">
                Ubah gaya visual aplikasi E-Lapor secara instan ke palet warna favorit Anda
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsThemeModalOpen(false)}
            className="p-2 rounded-xl text-natural-secondary hover:text-natural-primary hover:bg-natural-bg transition-colors border border-transparent hover:border-natural-border cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Theme Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {themes.map(t => {
              const isActive = t.id === theme;
              return (
                <div
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`relative p-5 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between group ${
                    isActive
                      ? 'border-natural-primary bg-natural-bg/30 shadow-md ring-2 ring-natural-primary/20'
                      : 'border-natural-border/80 hover:border-natural-primary/40 hover:shadow-sm bg-white'
                  }`}
                >
                  {/* Theme Header Preview Bar */}
                  <div className="space-y-3">
                    <div 
                      className="h-16 rounded-2xl p-3 flex items-center justify-between shadow-xs transition-transform group-hover:scale-[1.01]"
                      style={{ backgroundColor: t.primaryColor }}
                    >
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-5 h-5 rounded-full border border-white/60 shadow-xs flex items-center justify-center text-[9px] font-bold text-white"
                          style={{ backgroundColor: t.secondaryColor }}
                        >
                          E
                        </span>
                        <div className="leading-none">
                          <p className="text-white text-[11px] font-bold tracking-tight">E-Lapor</p>
                          <p className="text-white/70 text-[8px] uppercase tracking-wider">SMK MUH 1</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs">
                        {t.accentBadge}
                      </span>
                    </div>

                    {/* Color Swatch Dots */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-5 h-5 rounded-full border-2 border-white shadow-xs"
                          style={{ backgroundColor: t.primaryColor }}
                          title={`Primary: ${t.primaryColor}`}
                        />
                        <span
                          className="w-5 h-5 rounded-full border-2 border-white shadow-xs"
                          style={{ backgroundColor: t.secondaryColor }}
                          title={`Secondary: ${t.secondaryColor}`}
                        />
                        <span
                          className="w-5 h-5 rounded-full border border-slate-300 shadow-2xs"
                          style={{ backgroundColor: t.bgColor }}
                          title={`Background: ${t.bgColor}`}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-medium text-slate-400">
                        {t.primaryColor}
                      </span>
                    </div>

                    {/* Title and Description */}
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="font-serif italic font-bold text-base text-slate-900">
                          {t.name}
                        </h3>
                        {isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-natural-primary text-white flex items-center gap-1">
                            <Check className="w-3 h-3" /> Dipakai
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-slate-600 mt-0.5">{t.subtitle}</p>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                        {t.desc}
                      </p>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-medium tracking-wider">
                      {isActive ? 'Tema Sekarang' : 'Klik untuk ganti'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTheme(t.id);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
                        isActive
                          ? 'bg-natural-primary text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-natural-primary hover:text-white text-slate-700'
                      }`}
                    >
                      {isActive ? 'Aktif' : 'Terapkan'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-natural-border/60 bg-natural-bg/30 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-natural-secondary">
            <Sparkles className="w-4 h-4 text-natural-primary" />
            <span>Pilihan tema langsung tersimpan di peramban Anda untuk seterusnya.</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setTheme('emerald')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-natural-secondary hover:text-natural-primary hover:bg-natural-bg transition-colors flex items-center gap-1.5 border border-natural-border cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset ke Hijau Zamrud
            </button>
            <button
              type="button"
              onClick={() => setIsThemeModalOpen(false)}
              className="px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-natural-primary text-white shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Full Theme Settings Section to render inside SettingsPage -> Tab 'theme'
export const ThemeSettingsSection = () => {
  const { theme, setTheme, themes, currentTheme } = useTheme();

  return (
    <div className="space-y-8">
      {/* Active Theme Highlight Banner */}
      <div 
        className="p-8 rounded-[32px] border border-natural-border shadow-xs relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${currentTheme.bgColor} 0%, #ffffff 100%)`
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-natural-primary text-white shadow-2xs">
                Tema Aktif Saat Ini
              </span>
              <span className="text-xs text-natural-secondary font-mono">
                {currentTheme.id.toUpperCase()}
              </span>
            </div>
            <h3 className="text-3xl font-serif italic text-natural-primary font-bold">
              {currentTheme.name}
            </h3>
            <p className="text-sm text-natural-secondary leading-relaxed">
              {currentTheme.desc}
            </p>
          </div>

          {/* Interactive Live Mini-Widget */}
          <div className="bg-white p-5 rounded-2xl border border-natural-border shadow-sm w-full lg:w-80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-natural-border/50">
              <span className="text-xs font-bold text-natural-text uppercase tracking-wider">Preview Tombol & Warna</span>
              <div className="flex -space-x-1">
                <span className="w-4 h-4 rounded-full border border-white shadow-xs" style={{ backgroundColor: currentTheme.primaryColor }} />
                <span className="w-4 h-4 rounded-full border border-white shadow-xs" style={{ backgroundColor: currentTheme.secondaryColor }} />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                type="button"
                className="flex-1 py-2 px-3 rounded-xl bg-natural-primary text-white text-xs font-bold text-center shadow-xs"
              >
                Tombol Utama
              </button>
              <button 
                type="button"
                className="flex-1 py-2 px-3 rounded-xl bg-natural-secondary text-white text-xs font-bold text-center shadow-xs"
              >
                Aksen
              </button>
            </div>
            <div className="p-2.5 rounded-xl bg-natural-bg border border-natural-border text-center">
              <p className="text-[10px] text-natural-secondary font-medium">Contoh Teks di Atas Latar</p>
              <p className="text-sm font-mono font-bold text-natural-primary mt-0.5">Rp 25.000.000</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of All Available Themes */}
      <div className="bg-white p-6 sm:p-8 rounded-[36px] border border-natural-border shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-natural-border/60">
          <div>
            <h4 className="text-xl font-serif italic text-natural-primary font-bold">Daftar Pilihan Tema Aplikasi</h4>
            <p className="text-xs text-natural-secondary mt-1">
              Klik pada salah satu tema di bawah ini untuk langsung mengubah tampilan seluruh halaman aplikasi
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTheme('emerald')}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-natural-secondary hover:text-natural-primary hover:bg-natural-bg transition-colors flex items-center gap-1.5 border border-natural-border cursor-pointer w-fit"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Kembalikan ke Hijau Zamrud (Standar)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {themes.map(t => {
            const isActive = t.id === theme;
            return (
              <div
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`p-5 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between group ${
                  isActive
                    ? 'border-natural-primary bg-natural-bg/40 shadow-md ring-2 ring-natural-primary/20'
                    : 'border-natural-border/80 hover:border-natural-primary/40 hover:shadow-sm bg-white'
                }`}
              >
                <div className="space-y-3.5">
                  {/* Mini Card Header Visual */}
                  <div
                    className="h-16 rounded-2xl p-3 flex items-center justify-between shadow-2xs group-hover:scale-[1.01] transition-transform"
                    style={{ backgroundColor: t.primaryColor }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded-full border border-white/60 shadow-xs flex items-center justify-center text-[9px] font-bold text-white"
                        style={{ backgroundColor: t.secondaryColor }}
                      >
                        E
                      </span>
                      <div className="leading-none text-white">
                        <p className="text-[11px] font-bold">E-Lapor</p>
                        <p className="text-[8px] uppercase tracking-wider opacity-75">SMK MUH 1</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs">
                      {t.accentBadge}
                    </span>
                  </div>

                  {/* Swatches and Code */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-5 h-5 rounded-full border-2 border-white shadow-xs"
                        style={{ backgroundColor: t.primaryColor }}
                        title={`Primary: ${t.primaryColor}`}
                      />
                      <span
                        className="w-5 h-5 rounded-full border-2 border-white shadow-xs"
                        style={{ backgroundColor: t.secondaryColor }}
                        title={`Secondary: ${t.secondaryColor}`}
                      />
                      <span
                        className="w-5 h-5 rounded-full border border-slate-300 shadow-2xs"
                        style={{ backgroundColor: t.bgColor }}
                        title={`Background: ${t.bgColor}`}
                      />
                    </div>
                    <span className="text-[10px] font-mono font-medium text-natural-secondary">
                      {t.primaryColor}
                    </span>
                  </div>

                  {/* Texts */}
                  <div>
                    <div className="flex items-center justify-between">
                      <h5 className="font-serif italic font-bold text-base text-natural-text">
                        {t.name}
                      </h5>
                      {isActive && (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-natural-primary text-white flex items-center gap-1">
                          <Check className="w-3 h-3" /> Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-natural-secondary mt-0.5">{t.subtitle}</p>
                    <p className="text-[11px] text-natural-text/75 mt-1 leading-relaxed">
                      {t.desc}
                    </p>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-5 pt-3.5 border-t border-natural-border/60 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-natural-secondary uppercase tracking-wider">
                    {isActive ? 'Sedang Dipakai' : 'Siap Diterapkan'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTheme(t.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
                      isActive
                        ? 'bg-natural-primary text-white shadow-xs'
                        : 'bg-natural-bg hover:bg-natural-primary hover:text-white text-natural-text border border-natural-border'
                    }`}
                  >
                    {isActive ? 'Aktif' : 'Terapkan'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
