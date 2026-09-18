import React, { useState, useEffect } from 'react';
import { Building2, Upload, Trash2, Save, CheckCircle2, Image as ImageIcon, UserCheck, BadgeCheck, MapPin } from 'lucide-react';
import { SchoolSettings } from '../types';

interface SchoolSettingsViewProps {
  schoolSettings: SchoolSettings;
  onSave: (data: SchoolSettings) => Promise<void>;
}

export const SchoolSettingsView: React.FC<SchoolSettingsViewProps> = ({
  schoolSettings,
  onSave,
}) => {
  const [formData, setFormData] = useState<SchoolSettings>({
    schoolName: '',
    schoolLogo: '',
    principalName: '',
    principalNbm: '',
    treasurerName: '',
    treasurerNbm: '',
    schoolAddress: '',
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (schoolSettings) {
      setFormData({
        schoolName: schoolSettings.schoolName || 'SMK MUHAMMADIYAH 1 NGADIREJO',
        schoolLogo: schoolSettings.schoolLogo || '',
        principalName: schoolSettings.principalName || '',
        principalNbm: schoolSettings.principalNbm || '',
        treasurerName: schoolSettings.treasurerName || '',
        treasurerNbm: schoolSettings.treasurerNbm || '',
        schoolAddress: schoolSettings.schoolAddress || 'Jl. Raya Candiroto, Ngaren, Ngadirejo, Temanggung, Jawa Tengah',
      });
    }
  }, [schoolSettings]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran gambar maksimal 5 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const resizedDataUrl = canvas.toDataURL('image/png');
          setFormData(prev => ({ ...prev, schoolLogo: resizedDataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setFormData(prev => ({ ...prev, schoolLogo: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await onSave(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Error saving school settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white p-8 sm:p-10 rounded-[40px] border border-natural-border shadow-sm">
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-natural-border/60">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-serif italic text-natural-primary">Pengaturan Identitas Sekolah</h3>
            <p className="text-xs text-natural-secondary mt-0.5">
              Atur nama sekolah, logo, dan pejabat penandatangan untuk laporan Buku Kas
            </p>
          </div>
        </div>

        {saveSuccess && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="font-bold">Pengaturan sekolah berhasil diperbarui!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Logo & Nama Sekolah */}
          <div className="space-y-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-natural-primary flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              Identitas & Logo Sekolah
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Preview Logo */}
              <div className="flex flex-col items-center justify-center p-6 bg-natural-bg/50 border border-dashed border-natural-border rounded-3xl text-center space-y-3">
                {formData.schoolLogo ? (
                  <div className="relative group">
                    <img
                      src={formData.schoolLogo}
                      alt="Logo Sekolah"
                      className="w-28 h-28 object-contain rounded-xl p-2 bg-white shadow-sm border border-natural-border"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      title="Hapus Logo"
                      className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-white border border-natural-border flex flex-col items-center justify-center text-natural-secondary/50">
                    <Building2 className="w-10 h-10 mb-1" />
                    <span className="text-[10px]">Tanpa Logo</span>
                  </div>
                )}

                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white text-natural-primary border border-natural-border hover:bg-natural-bg rounded-xl text-xs font-bold transition-all shadow-xs">
                  <Upload className="w-3.5 h-3.5 text-natural-primary" />
                  {formData.schoolLogo ? 'Ganti Logo' : 'Unggah Logo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                <p className="text-[10px] text-natural-secondary/70">Format PNG/JPG (Maks 5 MB)</p>
              </div>

              {/* Nama & Alamat Sekolah */}
              <div className="md:col-span-2 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-natural-secondary mb-1.5">
                    Nama Sekolah / Instansi:
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.schoolName}
                    onChange={e => setFormData({ ...formData, schoolName: e.target.value })}
                    placeholder="Contoh: SMK MUHAMMADIYAH 1 NGADIREJO"
                    className="w-full px-4 py-3 bg-natural-bg/50 border border-natural-border rounded-2xl font-serif text-lg font-bold text-natural-primary focus:bg-white focus:outline-hidden focus:border-natural-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-natural-secondary mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Alamat Lengkap Sekolah:
                  </label>
                  <textarea
                    rows={2}
                    value={formData.schoolAddress}
                    onChange={e => setFormData({ ...formData, schoolAddress: e.target.value })}
                    placeholder="Contoh: Jl. Raya Candiroto, Ngaren, Ngadirejo, Temanggung, Jawa Tengah"
                    className="w-full px-4 py-3 bg-natural-bg/50 border border-natural-border rounded-2xl text-xs text-natural-primary focus:bg-white focus:outline-hidden focus:border-natural-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-natural-border/60 my-6" />

          {/* Section 2: Pejabat Penandatangan Laporan Buku Kas */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-natural-primary flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                Penandatangan Laporan Buku Kas
              </h4>
              <span className="text-[10px] font-bold px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
                Khusus Laporan Buku Kas (BKK)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Kepala Sekolah */}
              <div className="p-6 bg-natural-bg/30 border border-natural-border rounded-3xl space-y-4">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider pb-2 border-b border-natural-border/50">
                  <BadgeCheck className="w-4 h-4 text-emerald-600" />
                  Kepala Sekolah
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-natural-secondary mb-1">
                    Nama Lengkap Kepala Sekolah (beserta Gelar):
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.principalName}
                    onChange={e => setFormData({ ...formData, principalName: e.target.value })}
                    placeholder="Contoh: Drs. H. Suwandi, M.Pd."
                    className="w-full px-4 py-2.5 bg-white border border-natural-border rounded-2xl text-xs font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-natural-secondary mb-1">
                    Nomor NBM Kepala Sekolah:
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.principalNbm}
                    onChange={e => setFormData({ ...formData, principalNbm: e.target.value })}
                    placeholder="Contoh: 123 456 789"
                    className="w-full px-4 py-2.5 bg-white border border-natural-border rounded-2xl text-xs font-mono font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary"
                  />
                  <p className="text-[10px] text-amber-700 italic mt-1 font-medium">
                    * Catatan: Gunakan nomor NBM (Bukan NIP).
                  </p>
                </div>
              </div>

              {/* Bendahara Sekolah */}
              <div className="p-6 bg-natural-bg/30 border border-natural-border rounded-3xl space-y-4">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider pb-2 border-b border-natural-border/50">
                  <BadgeCheck className="w-4 h-4 text-emerald-600" />
                  Bendahara Sekolah
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-natural-secondary mb-1">
                    Nama Lengkap Bendahara Sekolah:
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.treasurerName}
                    onChange={e => setFormData({ ...formData, treasurerName: e.target.value })}
                    placeholder="Contoh: Ahmad Fauzi, S.E."
                    className="w-full px-4 py-2.5 bg-white border border-natural-border rounded-2xl text-xs font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-natural-secondary mb-1">
                    Nomor NBM / NIP Bendahara Sekolah (Opsional):
                  </label>
                  <input
                    type="text"
                    value={formData.treasurerNbm}
                    onChange={e => setFormData({ ...formData, treasurerNbm: e.target.value })}
                    placeholder="Contoh: 987 654 321"
                    className="w-full px-4 py-2.5 bg-white border border-natural-border rounded-2xl text-xs font-mono font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-4 border-t border-natural-border/60">
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3.5 rounded-full bg-natural-primary text-white text-xs font-bold uppercase tracking-wider hover:bg-natural-primary/90 transition-all shadow-md flex items-center gap-2.5 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan Sekolah'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
