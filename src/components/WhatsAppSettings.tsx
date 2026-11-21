import React, { useState, useEffect, useMemo } from 'react';
import { 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Key, 
  Smartphone, 
  ShieldCheck, 
  RefreshCw,
  Info,
  ExternalLink,
  BellRing,
  FilePlus2,
  ListChecks,
  Eye,
  EyeOff,
  Trash2,
  Sparkles,
  Check
} from 'lucide-react';
import { Firestore } from 'firebase/firestore';
import { safeConfirm } from '../lib/utils';
import { 
  getWhatsappSettings, 
  saveWhatsappSettings, 
  sendWabaTemplateMessage,
  sendWabaTextMessage,
  submitWabaTemplate,
  fetchWabaTemplates,
  deleteWabaTemplate,
  verifyWabaConnection,
  sanitizeWabaToken,
  sanitizeWabaId,
  normalizeWabaApiVersion,
  WhatsappSettings as IWhatsappSettings, 
  DEFAULT_WHATSAPP_SETTINGS,
  DEFAULT_WABA_API_VERSION,
  DEFAULT_STATUS_TEMPLATE_NAME,
  DEFAULT_OTP_TEMPLATE_NAME,
  WabaTemplateRecord
} from '../services/whatsapp';

const STATUS_TEMPLATE_PRESET_BODY =
  `Pemberitahuan Status E-Lapor Bendahara ({{1}})\n\n` +
  `Unit Kerja: {{2}}\n` +
  `Kegiatan: {{3}}\n` +
  `Nominal / Realisasi: {{4}}\n` +
  `Keterangan: {{5}}\n` +
  `Catatan Bendahara: {{6}}\n\n` +
  `Silakan buka sistem E-Lapor SMK Muhammadiyah 1 Ngadirejo untuk melihat rincian dan tindak lanjut.`;

const STATUS_TEMPLATE_PRESET_EXAMPLES = [
  'Anggaran Disetujui',
  'Kurikulum',
  'Workshop Kurikulum Merdeka',
  'Rp 5.000.000',
  'Pengajuan anggaran disetujui oleh Bendahara. Silakan koordinasi jadwal pelaksanaan.',
  'Harap melampirkan nota asli saat pelaporan'
];

export const WhatsAppSettings = ({ db, userEmail }: { db: Firestore; userEmail?: string }) => {
  const [settings, setSettings] = useState<IWhatsappSettings>(DEFAULT_WHATSAPP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [checkingConn, setCheckingConn] = useState(false);
  const [connResult, setConnResult] = useState<{ success: boolean; message: string } | null>(null);

  // Template Submission State (Ajukan Template WABA Official)
  const [tplName, setTplName] = useState(DEFAULT_STATUS_TEMPLATE_NAME);
  const [tplCategory, setTplCategory] = useState<'UTILITY' | 'AUTHENTICATION' | 'MARKETING'>('UTILITY');
  const [tplLanguage, setTplLanguage] = useState('id');
  const [tplHeaderText, setTplHeaderText] = useState('');
  const [tplHeaderExample, setTplHeaderExample] = useState('');
  const [tplBodyText, setTplBodyText] = useState(STATUS_TEMPLATE_PRESET_BODY);
  const [tplBodyExamples, setTplBodyExamples] = useState<string[]>(STATUS_TEMPLATE_PRESET_EXAMPLES);
  const [tplFooterText, setTplFooterText] = useState('Sistem Informasi Keuangan E-Lapor SMK Muh 1 Ngadirejo');
  const [tplAuthAddSec, setTplAuthAddSec] = useState(true);
  const [tplAuthExpMin, setTplAuthExpMin] = useState(10);
  const [tplAuthBtnText, setTplAuthBtnText] = useState('Salin Kode');
  const [submittingTpl, setSubmittingTpl] = useState(false);
  const [submitTplResult, setSubmitTplResult] = useState<{ success: boolean; message: string; response?: any } | null>(null);

  // Registered Templates List State
  const [wabaTemplates, setWabaTemplates] = useState<WabaTemplateRecord[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesMessage, setTemplatesMessage] = useState<{ success: boolean; text: string } | null>(null);

  // Test send state
  const [testMode, setTestMode] = useState<'template' | 'text'>('template');
  const [testNumber, setTestNumber] = useState('');
  const [testTemplateName, setTestTemplateName] = useState(DEFAULT_STATUS_TEMPLATE_NAME);
  const [testTemplateLang, setTestTemplateLang] = useState('id');
  const [testTemplateParams, setTestTemplateParams] = useState(STATUS_TEMPLATE_PRESET_EXAMPLES.join(' | '));
  const [testMessage, setTestMessage] = useState(
    'Halo! Ini adalah pesan uji coba integrasi WhatsApp WABA Official E-Lapor Bendahara SMK Muhammadiyah 1 Ngadirejo.'
  );
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
      if (data.statusTemplateName) {
        setTestTemplateName(data.statusTemplateName);
      }
      if (data.statusTemplateLanguage) {
        setTestTemplateLang(data.statusTemplateLanguage);
      }
    } catch (err: any) {
      setError('Gagal memuat pengaturan WhatsApp WABA: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Detect placeholders {{1}}, {{2}}, ... in bodyText
  const detectedBodyVars = useMemo(() => {
    if (tplCategory === 'AUTHENTICATION') return [];
    const matches = tplBodyText.match(/\{\{\d+\}\}/g) || [];
    return Array.from(new Set(matches)).sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''), 10);
      const nb = parseInt(b.replace(/\D/g, ''), 10);
      return na - nb;
    });
  }, [tplBodyText, tplCategory]);

  const handleApplyStatusPreset = () => {
    setTplName(DEFAULT_STATUS_TEMPLATE_NAME);
    setTplCategory('UTILITY');
    setTplLanguage('id');
    setTplHeaderText('');
    setTplHeaderExample('');
    setTplBodyText(STATUS_TEMPLATE_PRESET_BODY);
    setTplBodyExamples([...STATUS_TEMPLATE_PRESET_EXAMPLES]);
    setTplFooterText('Sistem Informasi Keuangan E-Lapor SMK Muh 1 Ngadirejo');
    setSubmitTplResult(null);
  };

  const handleApplyOtpPreset = () => {
    setTplName(DEFAULT_OTP_TEMPLATE_NAME);
    setTplCategory('AUTHENTICATION');
    setTplLanguage('id');
    setTplHeaderText('');
    setTplHeaderExample('');
    setTplAuthAddSec(true);
    setTplAuthExpMin(10);
    setTplAuthBtnText('Salin Kode');
    setSubmitTplResult(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    const cleanedSettings: IWhatsappSettings = {
      ...settings,
      wabaAccessToken: sanitizeWabaToken(settings.wabaAccessToken),
      wabaPhoneNumberId: sanitizeWabaId(settings.wabaPhoneNumberId),
      wabaAccountId: sanitizeWabaId(settings.wabaAccountId),
      wabaApiVersion: normalizeWabaApiVersion(settings.wabaApiVersion)
    };
    setSettings(cleanedSettings);
    try {
      await saveWhatsappSettings(db, cleanedSettings, userEmail);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setError('Gagal menyimpan pengaturan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCheckConnection = async () => {
    setCheckingConn(true);
    setConnResult(null);
    const cleanedToken = sanitizeWabaToken(settings.wabaAccessToken);
    const cleanedPhone = sanitizeWabaId(settings.wabaPhoneNumberId);
    const cleanedWaba = sanitizeWabaId(settings.wabaAccountId);
    const cleanedVersion = normalizeWabaApiVersion(settings.wabaApiVersion);
    setSettings(prev => ({
      ...prev,
      wabaAccessToken: cleanedToken,
      wabaPhoneNumberId: cleanedPhone,
      wabaAccountId: cleanedWaba,
      wabaApiVersion: cleanedVersion
    }));
    const res = await verifyWabaConnection({
      accessToken: cleanedToken,
      phoneNumberId: cleanedPhone,
      wabaAccountId: cleanedWaba,
      apiVersion: cleanedVersion
    });
    setConnResult({ success: res.success, message: res.message });
    setCheckingConn(false);
  };

  const handleFetchTemplates = async () => {
    setLoadingTemplates(true);
    setTemplatesMessage(null);
    const res = await fetchWabaTemplates({
      accessToken: settings.wabaAccessToken,
      wabaAccountId: settings.wabaAccountId,
      apiVersion: settings.wabaApiVersion || DEFAULT_WABA_API_VERSION
    });
    if (res.success) {
      setWabaTemplates(res.templates);
      setTemplatesMessage({ success: true, text: res.message });
    } else {
      setTemplatesMessage({ success: false, text: res.message });
    }
    setLoadingTemplates(false);
  };

  const handleSubmitTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingTpl(true);
    setSubmitTplResult(null);
    const res = await submitWabaTemplate({
      accessToken: settings.wabaAccessToken,
      wabaAccountId: settings.wabaAccountId,
      apiVersion: settings.wabaApiVersion || DEFAULT_WABA_API_VERSION,
      name: tplName,
      category: tplCategory,
      language: tplLanguage,
      headerText: tplHeaderText,
      headerExample: tplHeaderExample,
      bodyText: tplBodyText,
      bodyExamples: tplBodyExamples,
      footerText: tplFooterText,
      addSecurityRecommendation: tplAuthAddSec,
      codeExpirationMinutes: tplAuthExpMin,
      otpButtonText: tplAuthBtnText
    });
    setSubmitTplResult(res);
    setSubmittingTpl(false);
    if (res.success && settings.wabaAccessToken && settings.wabaAccountId) {
      handleFetchTemplates();
    }
  };

  const handleDeleteTemplate = async (templateName: string) => {
    if (!safeConfirm(`Hapus template "${templateName}" dari akun WABA Official Meta?`)) return;
    const res = await deleteWabaTemplate({
      accessToken: settings.wabaAccessToken,
      wabaAccountId: settings.wabaAccountId,
      apiVersion: settings.wabaApiVersion || DEFAULT_WABA_API_VERSION,
      templateName
    });
    setTemplatesMessage({ success: res.success, text: res.message });
    if (res.success) {
      handleFetchTemplates();
    }
  };

  const handleTestSend = async () => {
    if (!settings.wabaAccessToken?.trim() || !settings.wabaPhoneNumberId?.trim()) {
      setTestResult({
        success: false,
        message: 'Harap isi Access Token dan Phone Number ID WABA Official terlebih dahulu sebelum mengirim tes.'
      });
      return;
    }
    if (!testNumber || testNumber.trim().length < 9) {
      setTestResult({
        success: false,
        message: 'Harap masukkan nomor WhatsApp tujuan yang valid (contoh: 081234567890).'
      });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      if (testMode === 'template') {
        const parsedParams = testTemplateParams.trim()
          ? testTemplateParams.split('|').map(p => p.trim()).filter(Boolean)
          : [];
        const res = await sendWabaTemplateMessage({
          accessToken: settings.wabaAccessToken,
          phoneNumberId: settings.wabaPhoneNumberId,
          apiVersion: settings.wabaApiVersion || DEFAULT_WABA_API_VERSION,
          target: testNumber,
          templateName: testTemplateName,
          languageCode: testTemplateLang,
          bodyParams: parsedParams.length > 0 ? parsedParams : undefined
        });
        setTestResult({ success: res.success, message: res.message, details: res.response });
      } else {
        const res = await sendWabaTextMessage({
          accessToken: settings.wabaAccessToken,
          phoneNumberId: settings.wabaPhoneNumberId,
          apiVersion: settings.wabaApiVersion || DEFAULT_WABA_API_VERSION,
          target: testNumber,
          message: testMessage
        });
        setTestResult({ success: res.success, message: res.message, details: res.response });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Terjadi kesalahan saat mengirim pesan uji coba.' });
    } finally {
      setTesting(false);
    }
  };

  const previewBodyText = useMemo(() => {
    if (tplCategory === 'AUTHENTICATION') {
      return `*123456* adalah kode verifikasi Anda.${tplAuthAddSec ? ' Demi keamanan Anda, jangan bagikan kode ini kepada siapa pun.' : ''}${tplAuthExpMin > 0 ? `\n\nKode ini kedaluwarsa dalam ${tplAuthExpMin} menit.` : ''}`;
    }
    let out = tplBodyText;
    detectedBodyVars.forEach((placeholder, idx) => {
      const sample = tplBodyExamples[idx] || placeholder;
      out = out.split(placeholder).join(sample);
    });
    return out;
  }, [tplCategory, tplBodyText, detectedBodyVars, tplBodyExamples, tplAuthAddSec, tplAuthExpMin]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center">
        <RefreshCw className="w-8 h-8 animate-spin text-natural-primary mx-auto mb-4" />
        <p className="text-natural-secondary font-serif italic">Memuat konfigurasi WhatsApp WABA Official...</p>
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
            Meta WhatsApp Business API (WABA Official)
          </div>
          <h2 className="text-3xl font-serif italic text-natural-primary">Pengaturan Notifikasi WhatsApp</h2>
          <p className="text-natural-secondary text-xs uppercase tracking-widest font-bold mt-1">
            Notifikasi resmi status anggaran &amp; pengajuan template WABA Official
          </p>
        </div>
        <a 
          href="https://business.facebook.com/wa/manage/message-templates/" 
          target="_blank" 
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 border border-[#25D366]/30 rounded-full text-xs font-bold transition-all shrink-0"
        >
          <span>Buka Meta WhatsApp Manager</span>
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
          <span className="font-medium">Pengaturan WABA Official berhasil disimpan dan aktif!</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-white p-10 rounded-[40px] border border-natural-border shadow-sm space-y-8">
        <div className="border-b border-natural-bg pb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <h3 className="text-xl font-serif italic text-natural-primary flex items-center gap-2.5">
            <Key className="w-5 h-5 text-natural-secondary" />
            Konfigurasi API WABA Official (Meta Cloud API)
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
                Permanent Access Token (System User Token) <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-natural-secondary italic">
                Dari Meta Business Suite &rarr; System Users / WhatsApp API Setup
              </span>
            </div>
            <div className="relative">
              <input 
                type={showToken ? 'text' : 'password'}
                required={settings.enabled}
                className="w-full p-4 pl-11 pr-12 bg-natural-input border-b-2 border-natural-border focus:border-natural-primary outline-none font-mono text-sm tracking-wider" 
                placeholder="EAA... (tempel token tanpa kata Bearer atau spasi)"
                value={settings.wabaAccessToken || ''}
                onChange={e => {
                  const cleaned = sanitizeWabaToken(e.target.value);
                  setSettings({ ...settings, wabaAccessToken: cleaned });
                  setConnResult(null);
                }}
              />
              <Key className="w-4 h-4 text-natural-secondary absolute left-4 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-natural-secondary hover:text-natural-primary cursor-pointer"
                title={showToken ? 'Sembunyikan Token' : 'Tampilkan Token'}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {settings.wabaAccessToken && !settings.wabaAccessToken.startsWith('EAA') && (
              <p className="text-[11px] text-amber-700 font-medium">
                Catatan: Token Meta Cloud API resmi umumnya diawali huruf <span className="font-mono font-bold">EAA...</span>. Jika muncul error <em>&quot;Cannot parse access token&quot;</em>, pastikan Anda tidak menempel token Fonnte atau App Secret.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5 focus-within:text-natural-primary">
              <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                Phone Number ID <span className="text-red-500">*</span>
              </label>
              <input 
                type="text"
                required={settings.enabled}
                className="w-full p-4 bg-natural-input border-b-2 border-natural-border focus:border-natural-primary outline-none font-mono text-sm font-bold" 
                placeholder="Contoh: 412345678901234"
                value={settings.wabaPhoneNumberId || ''}
                onChange={e => setSettings({ ...settings, wabaPhoneNumberId: sanitizeWabaId(e.target.value) })}
              />
            </div>

            <div className="space-y-1.5 focus-within:text-natural-primary">
              <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                WABA Account ID (WABA ID) <span className="text-red-500">*</span>
              </label>
              <input 
                type="text"
                className="w-full p-4 bg-natural-input border-b-2 border-natural-border focus:border-natural-primary outline-none font-mono text-sm font-bold" 
                placeholder="Contoh: 512345678901234"
                value={settings.wabaAccountId || ''}
                onChange={e => setSettings({ ...settings, wabaAccountId: sanitizeWabaId(e.target.value) })}
              />
            </div>

            <div className="space-y-1.5 focus-within:text-natural-primary">
              <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                Versi Meta Graph API
              </label>
              <input 
                type="text"
                className="w-full p-4 bg-natural-input border-b-2 border-natural-border focus:border-natural-primary outline-none font-mono text-sm font-bold" 
                placeholder="v21.0"
                value={settings.wabaApiVersion || DEFAULT_WABA_API_VERSION}
                onChange={e => setSettings({ ...settings, wabaApiVersion: e.target.value.trim() })}
              />
            </div>
          </div>

          {/* Template Mapping Config */}
          <div className="p-5 bg-natural-bg/50 border border-natural-border rounded-3xl space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-natural-primary">
              Template WABA Official yang Digunakan Sistem
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                  Nama Template Notifikasi Status (Utility)
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    className="flex-1 p-3 bg-white border border-natural-border rounded-xl font-mono text-xs font-bold outline-none focus:border-natural-primary" 
                    placeholder={DEFAULT_STATUS_TEMPLATE_NAME}
                    value={settings.statusTemplateName || ''}
                    onChange={e => setSettings({ ...settings, statusTemplateName: e.target.value })}
                  />
                  <input 
                    type="text"
                    className="w-20 p-3 bg-white border border-natural-border rounded-xl font-mono text-xs font-bold text-center outline-none focus:border-natural-primary" 
                    placeholder="id"
                    title="Kode Bahasa (misal: id atau en_US)"
                    value={settings.statusTemplateLanguage || 'id'}
                    onChange={e => setSettings({ ...settings, statusTemplateLanguage: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                  Nama Template Verifikasi OTP (Authentication)
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    className="flex-1 p-3 bg-white border border-natural-border rounded-xl font-mono text-xs font-bold outline-none focus:border-natural-primary" 
                    placeholder={DEFAULT_OTP_TEMPLATE_NAME}
                    value={settings.otpTemplateName || ''}
                    onChange={e => setSettings({ ...settings, otpTemplateName: e.target.value })}
                  />
                  <input 
                    type="text"
                    className="w-20 p-3 bg-white border border-natural-border rounded-xl font-mono text-xs font-bold text-center outline-none focus:border-natural-primary" 
                    placeholder="id"
                    title="Kode Bahasa (misal: id atau en_US)"
                    value={settings.otpTemplateLanguage || 'id'}
                    onChange={e => setSettings({ ...settings, otpTemplateLanguage: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <label className="flex items-start gap-3 pt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={Boolean(settings.requireOtpVerification)}
                onChange={e => setSettings({ ...settings, requireOtpVerification: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded accent-emerald-600 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-natural-primary block">
                  Wajibkan Verifikasi OTP WhatsApp saat Pengaju Mengirim Usulan Anggaran
                </span>
                <span className="text-[11px] text-natural-secondary block">
                  Aktifkan opsi ini hanya jika template OTP di akun WABA Official Anda sudah berstatus <strong>APPROVED</strong> oleh Meta. Jika belum, pengaju tetap dapat menginput nomor WA untuk menerima notifikasi status tanpa terblokir OTP.
                </span>
              </div>
            </label>
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

        {connResult && (
          <div className={`p-4 rounded-2xl border flex items-start gap-3 text-xs ${connResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
            {connResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{connResult.message}</span>
          </div>
        )}

        <div className="flex flex-wrap justify-end items-center gap-3 pt-4">
          <button
            type="button"
            disabled={checkingConn || !settings.wabaAccessToken}
            onClick={handleCheckConnection}
            className="px-6 py-4 rounded-full border border-natural-border bg-natural-bg hover:bg-natural-primary hover:text-white text-natural-primary font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${checkingConn ? 'animate-spin' : ''}`} />
            <span>{checkingConn ? 'Mengecek Token...' : 'Cek Koneksi & Validasi Token'}</span>
          </button>

          <button 
            type="submit" 
            disabled={saving}
            className="bg-natural-primary text-white px-8 py-4 rounded-full font-serif italic text-base hover:bg-natural-primary/90 transition-all shadow-lg flex items-center gap-2 cursor-pointer"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Simpan Pengaturan WABA Official</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Ajukan Template WABA Official Section */}
      <div className="bg-white p-10 rounded-[40px] border border-natural-border shadow-sm space-y-8">
        <div className="border-b border-natural-bg pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-xl font-serif italic text-natural-primary flex items-center gap-2.5">
              <FilePlus2 className="w-5 h-5 text-emerald-600" />
              Ajukan Template WABA Official
            </h3>
            <p className="text-natural-secondary text-xs mt-1">
              Buat dan ajukan template pesan baru langsung ke akun Meta WhatsApp Business API (WABA ID) untuk persetujuan resmi Meta.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleApplyStatusPreset}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Preset Template Status E-Lapor
            </button>
            <button
              type="button"
              onClick={handleApplyOtpPreset}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Preset Template OTP
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmitTemplate} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1 space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                  Nama Template <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full p-3 bg-natural-input border border-natural-border rounded-xl font-mono text-xs font-bold outline-none focus:border-natural-primary"
                  placeholder="elapor_notifikasi_status"
                  value={tplName}
                  onChange={e => setTplName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                  Kategori
                </label>
                <select
                  className="w-full p-3 bg-natural-input border border-natural-border rounded-xl text-xs font-bold outline-none focus:border-natural-primary"
                  value={tplCategory}
                  onChange={e => setTplCategory(e.target.value as any)}
                >
                  <option value="UTILITY">UTILITY (Notifikasi Status)</option>
                  <option value="AUTHENTICATION">AUTHENTICATION (OTP)</option>
                  <option value="MARKETING">MARKETING</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                  Bahasa
                </label>
                <select
                  className="w-full p-3 bg-natural-input border border-natural-border rounded-xl text-xs font-bold outline-none focus:border-natural-primary"
                  value={tplLanguage}
                  onChange={e => setTplLanguage(e.target.value)}
                >
                  <option value="id">Indonesia (id)</option>
                  <option value="en_US">English US (en_US)</option>
                  <option value="en">English (en)</option>
                </select>
              </div>
            </div>

            {tplCategory === 'AUTHENTICATION' ? (
              <div className="p-5 bg-blue-50/50 border border-blue-200 rounded-2xl space-y-4">
                <p className="text-xs font-bold text-blue-900">
                  Konfigurasi Template Autentikasi OTP Resmi Meta
                </p>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tplAuthAddSec}
                    onChange={e => setTplAuthAddSec(e.target.checked)}
                    className="accent-blue-600"
                  />
                  <span>Sertakan peringatan keamanan (&quot;Jangan bagikan kode ini&quot;)</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-natural-secondary">
                      Masa Berlaku Kode (Menit)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      className="w-full p-2.5 bg-white border border-blue-200 rounded-xl text-xs font-mono font-bold"
                      value={tplAuthExpMin}
                      onChange={e => setTplAuthExpMin(Number(e.target.value) || 10)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-natural-secondary">
                      Teks Tombol Salin OTP
                    </label>
                    <input
                      type="text"
                      className="w-full p-2.5 bg-white border border-blue-200 rounded-xl text-xs font-bold"
                      value={tplAuthBtnText}
                      onChange={e => setTplAuthBtnText(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                      Header Teks (Opsional)
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 bg-natural-input border border-natural-border rounded-xl text-xs outline-none focus:border-natural-primary"
                      placeholder="Kosongkan jika tanpa header"
                      value={tplHeaderText}
                      onChange={e => setTplHeaderText(e.target.value)}
                    />
                  </div>
                  {/\{\{\d+\}\}/.test(tplHeaderText) && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                        Contoh Variabel Header
                      </label>
                      <input
                        type="text"
                        className="w-full p-3 bg-natural-input border border-natural-border rounded-xl text-xs outline-none focus:border-natural-primary"
                        placeholder="ANGGARAN DISETUJUI"
                        value={tplHeaderExample}
                        onChange={e => setTplHeaderExample(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                    Isi Pesan Template (Body) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={7}
                    required
                    className="w-full p-3.5 bg-natural-input border border-natural-border rounded-2xl text-xs font-mono leading-relaxed outline-none focus:border-natural-primary"
                    value={tplBodyText}
                    onChange={e => setTplBodyText(e.target.value)}
                  />
                  <p className="text-[10px] text-natural-secondary italic">
                    Gunakan placeholder berurutan seperti {'{{1}}'}, {'{{2}}'}, dst. untuk variabel dinamis.
                  </p>
                </div>

                {detectedBodyVars.length > 0 && (
                  <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                      Contoh Nilai Variabel (Wajib Diisi untuk Review Meta)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {detectedBodyVars.map((varName, idx) => (
                        <div key={varName} className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold text-amber-800 w-10 shrink-0">
                            {varName}
                          </span>
                          <input
                            type="text"
                            required
                            className="flex-1 p-2 bg-white border border-amber-200 rounded-lg text-xs outline-none focus:border-amber-500"
                            placeholder={`Contoh untuk ${varName}`}
                            value={tplBodyExamples[idx] || ''}
                            onChange={e => {
                              const next = [...tplBodyExamples];
                              next[idx] = e.target.value;
                              setTplBodyExamples(next);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                    Footer Teks (Opsional)
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 bg-natural-input border border-natural-border rounded-xl text-xs outline-none focus:border-natural-primary"
                    placeholder="Sistem Informasi Keuangan E-Lapor SMK Muh 1 Ngadirejo"
                    value={tplFooterText}
                    onChange={e => setTplFooterText(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={submittingTpl || !settings.wabaAccessToken || !settings.wabaAccountId}
                className="w-full sm:w-auto px-7 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-full font-serif italic text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {submittingTpl ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mengajukan ke Meta WABA...</span>
                  </>
                ) : (
                  <>
                    <FilePlus2 className="w-4 h-4" />
                    <span>Ajukan Template ke Meta WABA Official</span>
                  </>
                )}
              </button>
              {(!settings.wabaAccessToken || !settings.wabaAccountId) && (
                <p className="text-[11px] text-amber-700 italic mt-2">
                  *Isi &amp; simpan Permanent Access Token dan WABA Account ID terlebih dahulu untuk mengajukan template ke Meta.
                </p>
              )}
            </div>
          </div>

          {/* Live WhatsApp Bubble Preview */}
          <div className="lg:col-span-5">
            <div className="p-6 rounded-3xl bg-[#efeae2] border border-natural-border space-y-3 h-full">
              <p className="text-[10px] font-bold uppercase tracking-widest text-natural-secondary">
                Pratinjau Tampilan WhatsApp
              </p>
              <div className="bg-white rounded-2xl rounded-tl-none p-4 shadow-sm border border-black/5 space-y-2 max-w-sm">
                {tplCategory !== 'AUTHENTICATION' && tplHeaderText && (
                  <p className="text-xs font-bold text-slate-900">
                    {tplHeaderText.replace(/\{\{\d+\}\}/g, tplHeaderExample || 'Header')}
                  </p>
                )}
                <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {previewBodyText}
                </p>
                {tplCategory !== 'AUTHENTICATION' && tplFooterText && (
                  <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                    {tplFooterText}
                  </p>
                )}
                {tplCategory === 'AUTHENTICATION' && (
                  <div className="pt-2 border-t border-slate-100 text-center">
                    <span className="inline-block text-xs font-bold text-[#00a884]">
                      📋 {tplAuthBtnText || 'Salin Kode'}
                    </span>
                  </div>
                )}
                <div className="text-right text-[9px] text-slate-400">12:00 ✓✓</div>
              </div>
              <div className="text-[11px] text-slate-600 bg-white/70 p-3 rounded-xl space-y-1">
                <p><strong>Nama:</strong> <span className="font-mono">{tplName || '-'}</span></p>
                <p><strong>Kategori:</strong> {tplCategory} | <strong>Bahasa:</strong> {tplLanguage}</p>
              </div>
            </div>
          </div>
        </form>

        {submitTplResult && (
          <div className={`p-5 rounded-2xl border flex items-start gap-3 text-sm ${submitTplResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
            {submitTplResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 overflow-hidden w-full">
              <p className="font-bold">
                {submitTplResult.success ? 'Pengajuan Template Berhasil!' : 'Pengajuan Template Gagal'}
              </p>
              <p className="text-xs">{submitTplResult.message}</p>
              {submitTplResult.response && (
                <pre className="text-[10px] font-mono bg-black/5 p-2 rounded mt-2 overflow-x-auto">
                  {JSON.stringify(submitTplResult.response, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* Registered Templates Table */}
        <div className="pt-4 border-t border-natural-bg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-natural-primary flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-natural-secondary" />
              Daftar Template Terdaftar di WABA Official
            </h4>
            <button
              type="button"
              disabled={loadingTemplates || !settings.wabaAccessToken || !settings.wabaAccountId}
              onClick={handleFetchTemplates}
              className="px-4 py-2 bg-natural-bg hover:bg-natural-primary hover:text-white text-natural-primary border border-natural-border rounded-full text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTemplates ? 'animate-spin' : ''}`} />
              <span>{loadingTemplates ? 'Memuat...' : 'Muat / Segarkan Status Template'}</span>
            </button>
          </div>

          {templatesMessage && (
            <div className={`p-3 rounded-xl text-xs font-medium ${templatesMessage.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
              {templatesMessage.text}
            </div>
          )}

          {wabaTemplates.length > 0 && (
            <div className="overflow-x-auto border border-natural-border rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-natural-bg/60 border-b border-natural-border text-[10px] uppercase tracking-wider text-natural-secondary">
                  <tr>
                    <th className="py-3 px-4">Nama Template</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Bahasa</th>
                    <th className="py-3 px-4">Status Meta</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-natural-bg">
                  {wabaTemplates.map((tpl) => {
                    const statusUpper = (tpl.status || '').toUpperCase();
                    const badgeClass =
                      statusUpper === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : statusUpper === 'PENDING'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-rose-100 text-rose-800 border-rose-200';
                    return (
                      <tr key={tpl.id} className="hover:bg-natural-bg/20">
                        <td className="py-3 px-4 font-mono font-bold text-natural-primary">
                          <div>{tpl.name}</div>
                          {tpl.rejected_reason && tpl.rejected_reason !== 'NONE' && (
                            <div className="text-[10px] font-sans font-normal text-rose-600 mt-0.5">
                              Alasan: {tpl.rejected_reason}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold">{tpl.category}</td>
                        <td className="py-3 px-4 font-mono">{tpl.language}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
                            {tpl.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {tpl.category !== 'AUTHENTICATION' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSettings(prev => ({
                                    ...prev,
                                    statusTemplateName: tpl.name,
                                    statusTemplateLanguage: tpl.language
                                  }));
                                  setTestTemplateName(tpl.name);
                                  setTestTemplateLang(tpl.language);
                                }}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                title="Gunakan template ini untuk notifikasi status"
                              >
                                <Check className="w-3 h-3" />
                                Pakai Status
                              </button>
                            )}
                            {tpl.category === 'AUTHENTICATION' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSettings(prev => ({
                                    ...prev,
                                    otpTemplateName: tpl.name,
                                    otpTemplateLanguage: tpl.language
                                  }));
                                }}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                title="Gunakan template ini untuk OTP"
                              >
                                <Check className="w-3 h-3" />
                                Pakai OTP
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteTemplate(tpl.name)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 border border-rose-200 rounded-lg transition-all cursor-pointer"
                              title="Hapus Template"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Test Sending Card */}
      <div className="bg-white p-10 rounded-[40px] border border-natural-border shadow-sm space-y-6">
        <div className="border-b border-natural-bg pb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h3 className="text-xl font-serif italic text-natural-primary flex items-center gap-2.5">
              <Send className="w-5 h-5 text-emerald-600" />
              Uji Coba Kirim Pesan WABA Official
            </h3>
            <p className="text-natural-secondary text-xs mt-1">
              Kirim pesan uji coba menggunakan Template WABA yang sudah disetujui atau pesan teks dalam jendela 24 jam.
            </p>
          </div>
          <div className="flex bg-natural-bg p-1 rounded-full border border-natural-border">
            <button
              type="button"
              onClick={() => setTestMode('template')}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                testMode === 'template' ? 'bg-natural-primary text-white shadow-xs' : 'text-natural-secondary'
              }`}
            >
              Mode Template
            </button>
            <button
              type="button"
              onClick={() => setTestMode('text')}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                testMode === 'text' ? 'bg-natural-primary text-white shadow-xs' : 'text-natural-secondary'
              }`}
            >
              Mode Teks Bebas
            </button>
          </div>
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

          {testMode === 'template' ? (
            <>
              <div className="space-y-1.5 focus-within:text-natural-primary">
                <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                  Nama Template &amp; Bahasa (contoh: hello_world | en_US)
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    className="flex-1 p-4 bg-natural-input border-b-2 border-natural-border focus:border-natural-primary outline-none text-xs font-mono font-bold" 
                    value={testTemplateName}
                    onChange={e => setTestTemplateName(e.target.value)}
                  />
                  <input 
                    type="text"
                    className="w-20 p-4 bg-natural-input border-b-2 border-natural-border focus:border-natural-primary outline-none text-xs font-mono font-bold text-center" 
                    value={testTemplateLang}
                    onChange={e => setTestTemplateLang(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5 focus-within:text-natural-primary">
                <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                  Parameter Body (pisahkan dengan | , kosongkan jika tanpa variabel)
                </label>
                <input 
                  type="text"
                  className="w-full p-4 bg-natural-input border-b-2 border-natural-border focus:border-natural-primary outline-none text-xs" 
                  placeholder="Kosongkan untuk hello_world"
                  value={testTemplateParams}
                  onChange={e => setTestTemplateParams(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="md:col-span-2 space-y-1.5 focus-within:text-natural-primary">
              <label className="text-[10px] uppercase font-bold tracking-wider text-natural-secondary">
                Pesan Uji Coba (Khusus nomor yang baru chat dalam 24 jam terakhir)
              </label>
              <input 
                type="text"
                className="w-full p-4 bg-natural-input border-b-2 border-natural-border focus:border-natural-primary outline-none text-xs" 
                value={testMessage}
                onChange={e => setTestMessage(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button 
            type="button"
            disabled={testing || !settings.wabaAccessToken || !settings.wabaPhoneNumberId}
            onClick={handleTestSend}
            className="bg-[#128C7E] hover:bg-[#075E54] text-white px-8 py-3.5 rounded-full font-serif italic text-sm transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {testing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Mengirim via WABA Official...</span>
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
            <div className="space-y-1 overflow-hidden w-full">
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
          <h3 className="text-xl font-serif italic text-natural-primary">Daftar Status yang Memicu Notifikasi WABA Official</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider">1. Anggaran Disetujui</span>
            <p className="text-xs text-slate-700">Mengirimkan pemberitahuan bahwa pengajuan anggaran disetujui beserta jumlah pagu dana yang disahkan.</p>
          </div>

          <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold uppercase text-blue-700 tracking-wider">2. Instruksi Pengisian LPJ</span>
            <p className="text-xs text-slate-700">Memberitahukan kepada pengaju bahwa dana telah dicairkan dan tahap pelaporan LPJ dibuka.</p>
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
            <span className="text-[10px] font-bold uppercase text-teal-700 tracking-wider">5. Laporan Disetujui &amp; Selesai</span>
            <p className="text-xs text-slate-700">Pemberitahuan resmi bahwa LPJ telah disahkan Bendahara beserta total realisasi dan sisa/kekurangan kas.</p>
          </div>

          <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-700 tracking-wider">6. Pengajuan Ditolak</span>
            <p className="text-xs text-slate-700">Pemberitahuan jika usulan anggaran ditolak oleh Bendahara beserta alasannya.</p>
          </div>
        </div>

        <div className="p-4 bg-natural-bg/50 border border-natural-border rounded-2xl flex items-start gap-3 text-xs text-natural-secondary">
          <Info className="w-4 h-4 flex-shrink-0 text-natural-primary mt-0.5" />
          <p>
            Pastikan template <span className="font-mono font-bold text-natural-primary">{settings.statusTemplateName || DEFAULT_STATUS_TEMPLATE_NAME}</span> sudah diajukan melalui form di atas dan berstatus <strong>APPROVED</strong> di Meta WhatsApp Manager agar seluruh notifikasi status berjalan lancar.
          </p>
        </div>
      </div>
    </div>
  );
};
