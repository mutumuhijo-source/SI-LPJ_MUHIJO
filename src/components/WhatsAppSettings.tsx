import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Key, 
  Smartphone, 
  ShieldCheck, 
  RefreshCw,
  Info,
  ExternalLink,
  BellRing
} from 'lucide-react';
import { Firestore } from 'firebase/firestore';
import { 
  getWhatsappSettings, 
  saveWhatsappSettings, 
  sendFonnteMessage, 
  WhatsappSettings as IWhatsappSettings, 
  DEFAULT_WHATSAPP_SETTINGS,
  formatPhoneNumber 
} from '../services/whatsapp';

export const WhatsAppSettings = ({ db, userEmail }: { db: Firestore; userEmail?: string }) => {
  const [settings, setSettings] = useState<IWhatsappSettings>(DEFAULT_WHATSAPP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Test send state
  const [testNumber, setTestNumber] = useState('');
  const [testMessage, setTestMessage] = useState('Halo! Ini adalah pesan uji coba integrasi notifikasi WhatsApp E-Lapor Bendahara SMK Muhammadiyah 1 Ngadirejo melalui Fonnte.com. Sistem notifikasi WhatsApp aktif dan siap digunakan.');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  useEffect(() => {
    loadSettings();
  }, [db]);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWhatsappSettings(db);
      setSettings(data);
    } catch (err: any) {
      setError('Gagal memuat pengaturan WhatsApp: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      await saveWhatsappSettings(db, settings, userEmail);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setError('Gagal menyimpan pengaturan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    if (!settings.fonnteToken || !settings.fonnteToken.trim()) {
      setTestResult({ success: false, message: 'Harap isi dan simpan Token API Fonnte terlebih dahulu sebelum mengirim tes.' });
      return;
    }
    if (!testNumber || testNumber.trim().length < 8) {
      setTestResult({ success: false, message: 'Harap masukkan nomor WhatsApp tujuan yang valid (contoh: 081234567890).' });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await sendFonnteMessage({
        token: settings.fonnteToken,
        target: testNumber,
        message: testMessage
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Terjadi kesalahan saat mengirim pesan uji coba.' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center">
        <RefreshCw className="w-8 h-8 animate-spin text-natural-primary mx-auto mb-4" />
        <p className="text-natural-secondary font-serif italic">Memuat konfigurasi WhatsApp Fonnte...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header Card */}
      <div className="bg-white p-10 rounded-[40px] border border-natural-border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-widest mb-3">
            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
            Integrasi Fonnte.com
          </div>
          <h2 className="text-3xl font-serif italic text-natural-primary">Pengaturan Notifikasi WhatsApp</h2>
          <p className="text-natural-secondary text-xs uppercase tracking-widest font-bold mt-1">
            Kirim otomatis pemberitahuan status anggaran & laporan ke nomor WhatsApp pengaju
          </p>
        </div>
        <a 
          href="https://fonnte.com" 
          target="_blank" 
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 border border-[#25D366]/30 rounded-full text-xs font-bold transition-all"
        >
          <span>Buka Dashboard Fonnte</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-medium">Pengaturan WhatsApp Fonnte berhasil disimpan! Notifikasi otomatis telah aktif.</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-white p-10 rounded-[40px] border border-natural-border shadow-sm space-y-8">
        <div className="border-b border-natural-bg pb-6 flex justify-between items-center">
          <h3 className="text-xl font-serif italic text-natural-primary flex items-center gap-2.5">
            <Key className="w-5 h-5 text-natural-secondary" />
            Konfigurasi API Fonnte
          </h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={settings.enabled} 
              onChange={e => setSettings({ ...settings, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            <span className="ml-3 text-xs font-bold uppercase tracking-wider text-natural-primary">
              {settings.enabled ? 'Notifikasi Aktif' : 'Notifikasi Nonaktif'}
            </span>
          </label>
        </div>

        <div className="space-y-6">
          <div className="space-y-2 focus-within:text-natural-primary">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                Token API Fonnte (Device Token) <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-natural-secondary italic">
                Dapatkan dari menu "Device" di Fonnte.com
              </span>
            </div>
            <div className="relative">
              <input 
                type="text"
                required={settings.enabled}
                className="w-full p-4 pl-11 bg-natural-input border-b-2 border-natural-border focus:border-natural-primary outline-none font-mono text-sm tracking-wider" 
                placeholder="Contoh: 7kx9Az... (Token API dari Fonnte)"
                value={settings.fonnteToken}
                onChange={e => setSettings({ ...settings, fonnteToken: e.target.value })}
              />
              <Key className="w-4 h-4 text-natural-secondary absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
            <p className="text-xs text-natural-secondary italic">
              Token ini digunakan untuk mengirim pesan notifikasi secara otomatis ke nomor WhatsApp pengaju saat status kegiatan diperbarui.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5 focus-within:text-natural-primary">
              <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                Nama Pengirim di Footer Notifikasi
              </label>
              <input 
                type="text"
                className="w-full p-4 bg-natural-input border-b-2 border-natural-border focus:border-natural-primary outline-none text-sm font-bold" 
                placeholder="E.g. Bendahara SMK MUH 1 NGADIREJO"
                value={settings.senderName || ''}
                onChange={e => setSettings({ ...settings, senderName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 focus-within:text-natural-primary">
              <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                Nama Lembaga / Sekolah
              </label>
              <input 
                type="text"
                className="w-full p-4 bg-natural-input border-b-2 border-natural-border focus:border-natural-primary outline-none text-sm font-bold" 
                placeholder="E.g. SMK MUHAMMADIYAH 1 NGADIREJO"
                value={settings.schoolName || ''}
                onChange={e => setSettings({ ...settings, schoolName: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button 
            type="submit" 
            disabled={saving}
            className="bg-natural-primary text-white px-8 py-4 rounded-full font-serif italic text-base hover:bg-natural-primary/90 transition-all shadow-lg flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Simpan Pengaturan WhatsApp</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Test Sending Card */}
      <div className="bg-white p-10 rounded-[40px] border border-natural-border shadow-sm space-y-6">
        <div className="border-b border-natural-bg pb-4">
          <h3 className="text-xl font-serif italic text-natural-primary flex items-center gap-2.5">
            <Send className="w-5 h-5 text-emerald-600" />
            Uji Coba Kirim Pesan WhatsApp
          </h3>
          <p className="text-natural-secondary text-xs mt-1">
            Kirim pesan uji coba untuk memverifikasi apakah Token Fonnte dan nomor WhatsApp tujuan terhubung dengan baik.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="md:col-span-1 space-y-1.5 focus-within:text-natural-primary">
            <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
              Nomor WhatsApp Tujuan Uji Coba
            </label>
            <div className="relative">
              <input 
                type="text"
                className="w-full p-4 pl-10 bg-natural-input border-b-2 border-natural-border focus:border-natural-primary outline-none text-sm font-bold font-mono" 
                placeholder="081234567890"
                value={testNumber}
                onChange={e => setTestNumber(e.target.value)}
              />
              <Smartphone className="w-4 h-4 text-natural-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="md:col-span-2 space-y-1.5 focus-within:text-natural-primary">
            <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
              Pesan Uji Coba
            </label>
            <input 
              type="text"
              className="w-full p-4 bg-natural-input border-b-2 border-natural-border focus:border-natural-primary outline-none text-xs" 
              value={testMessage}
              onChange={e => setTestMessage(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button 
            type="button"
            disabled={testing || !settings.fonnteToken}
            onClick={handleTestSend}
            className="bg-[#128C7E] hover:bg-[#075E54] text-white px-8 py-3.5 rounded-full font-serif italic text-sm transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
          >
            {testing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Mengirim ke WhatsApp...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Kirim Pesan Uji Coba</span>
              </>
            )}
          </button>
        </div>

        {testResult && (
          <div className={`p-5 rounded-2xl border flex items-start gap-3 text-sm ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            {testResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-bold">{testResult.success ? 'Pengiriman Berhasil!' : 'Pengiriman Gagal'}</p>
              <p className="text-xs">{testResult.message}</p>
              {testResult.details && (
                <pre className="text-[10px] font-mono bg-black/5 p-2 rounded mt-2 overflow-x-auto">
                  {JSON.stringify(testResult.details, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Info & Status Guide */}
      <div className="bg-white p-10 rounded-[40px] border border-natural-border shadow-sm space-y-6">
        <div className="border-b border-natural-bg pb-4 flex items-center gap-3">
          <BellRing className="w-5 h-5 text-natural-primary" />
          <h3 className="text-xl font-serif italic text-natural-primary">Daftar Status yang Memicu Notifikasi WhatsApp</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider">1. Anggaran Disetujui</span>
            <p className="text-xs text-slate-700">Mengirimkan pemberitahuan bahwa pengajuan anggaran disetujui, jumlah pagu dana yang disahkan, dan instruksi pelaksanaan.</p>
          </div>

          <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold uppercase text-blue-700 tracking-wider">2. Instruksi Pengisian LPJ</span>
            <p className="text-xs text-slate-700">Memberitahukan kepada pengaju bahwa tahap pelaporan dibuka untuk menginput bukti rincian belanja.</p>
          </div>

          <div className="p-4 bg-orange-50/70 border border-orange-100 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold uppercase text-orange-700 tracking-wider">3. Instruksi Revisi (Peringatan)</span>
            <p className="text-xs text-slate-700">Mengirimkan catatan koreksi dari Bendahara ke WhatsApp pengaju agar segera diperbaiki.</p>
          </div>

          <div className="p-4 bg-amber-50/70 border border-amber-100 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold uppercase text-amber-700 tracking-wider">4. Laporan Belum Lengkap</span>
            <p className="text-xs text-slate-700">Memberikan peringatan jika ada rincian yang belum lengkap (misal belanja pegawai tanpa nama pegawai).</p>
          </div>

          <div className="p-4 bg-teal-50/70 border border-teal-100 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold uppercase text-teal-700 tracking-wider">5. Laporan Disetujui & Selesai</span>
            <p className="text-xs text-slate-700">Pemberitahuan resmi bahwa LPJ telah disahkan Bendahara dengan rincian total realisasi dan sisa saldo/kekurangan kas.</p>
          </div>

          <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-700 tracking-wider">6. Laporan Diarsipkan & Ditolak</span>
            <p className="text-xs text-slate-700">Pemberitahuan saat laporan diarsipkan ke buku kas atau jika ada pengajuan yang ditolak beserta alasannya.</p>
          </div>
        </div>

        <div className="p-4 bg-natural-bg/50 border border-natural-border rounded-2xl flex items-start gap-3 text-xs text-natural-secondary">
          <Info className="w-4 h-4 flex-shrink-0 text-natural-primary mt-0.5" />
          <p>
            Nomor WhatsApp pengaju diinput saat pertama kali mengajukan anggaran di formulir pengajuan. Nomor tersebut dapat diperbarui kapan saja pada menu Detail Laporan jika diperlukan.
          </p>
        </div>
      </div>
    </div>
  );
};
