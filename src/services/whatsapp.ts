import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { Report, ReportStatus } from '../types';

export interface WhatsappSettings {
  fonnteToken: string;
  enabled: boolean;
  senderName?: string;
  schoolName?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export const DEFAULT_WHATSAPP_SETTINGS: WhatsappSettings = {
  fonnteToken: '',
  enabled: true,
  senderName: 'Bendahara SMK MUH 1 NGADIREJO',
  schoolName: 'SMK MUHAMMADIYAH 1 NGADIREJO'
};

/**
 * Format string nomor HP menjadi format standar WhatsApp yang diterima Fonnte
 * Contoh: '0812-3456-7890' -> '081234567890'
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Ambil hanya digit
  let cleaned = phone.replace(/\D/g, '');
  
  // Jika diawali +62 atau 62, tetap atau jika diawali 08
  if (cleaned.startsWith('0')) {
    // Fonnte bisa menerima format 08 atau 628 dengan countryCode 62
    return cleaned;
  }
  if (cleaned.startsWith('8')) {
    return '0' + cleaned;
  }
  return cleaned;
}

/**
 * Mengambil konfigurasi WhatsApp dari Firestore
 */
export async function getWhatsappSettings(db: Firestore): Promise<WhatsappSettings> {
  try {
    const docRef = doc(db, 'settings', 'whatsapp');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { ...DEFAULT_WHATSAPP_SETTINGS, ...snap.data() } as WhatsappSettings;
    }
  } catch (e) {
    console.warn('Failed to fetch whatsapp settings from firestore:', e);
  }

  // Fallback to env variable if available
  const envToken = (import.meta as any).env?.VITE_FONNTE_TOKEN || '';
  return {
    ...DEFAULT_WHATSAPP_SETTINGS,
    fonnteToken: envToken
  };
}

/**
 * Menyimpan konfigurasi WhatsApp ke Firestore
 */
export async function saveWhatsappSettings(db: Firestore, settings: Partial<WhatsappSettings>, userEmail?: string): Promise<void> {
  const docRef = doc(db, 'settings', 'whatsapp');
  await setDoc(docRef, {
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy: userEmail || 'admin'
  }, { merge: true });
}

/**
 * Kirim pesan WhatsApp melalui API Fonnte.com
 */
export async function sendFonnteMessage({
  token,
  target,
  message
}: {
  token: string;
  target: string;
  message: string;
}): Promise<{ success: boolean; message: string; response?: any }> {
  if (!token || !token.trim()) {
    return { success: false, message: 'Token Fonnte belum dikonfigurasi.' };
  }

  const cleanTarget = formatPhoneNumber(target);
  if (!cleanTarget || cleanTarget.length < 8) {
    return { success: false, message: 'Nomor WhatsApp tujuan tidak valid.' };
  }

  try {
    const formData = new FormData();
    formData.append('target', cleanTarget);
    formData.append('message', message);
    formData.append('countryCode', '62');

    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token.trim()
      },
      body: formData
    });

    const data = await res.json();

    if (res.ok && (data.status === true || data.status === 'true' || data.detail === 'success')) {
      return { success: true, message: 'Pesan WhatsApp berhasil terkirim.', response: data };
    } else {
      return { 
        success: false, 
        message: data.reason || data.message || data.detail || 'Gagal mengirim pesan WhatsApp via Fonnte.', 
        response: data 
      };
    }
  } catch (error: any) {
    console.error('Error sending WhatsApp message via Fonnte:', error);
    return { 
      success: false, 
      message: error.message || 'Terjadi kesalahan jaringan saat menghubungi server Fonnte.' 
    };
  }
}

/**
 * Format nominal Rupiah untuk teks WhatsApp
 */
function formatRupiahText(amount: number): string {
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);
}

/**
 * Format tanggal Indonesia
 */
function formatIndoDate(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return dateStr || '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(d);
}

/**
 * Menghasilkan pesan notifikasi WhatsApp berdasarkan status kegiatan
 */
export function buildStatusNotificationMessage(
  report: Report,
  status: ReportStatus,
  notes?: string
): string {
  const unit = report.unitName || 'Unit Kerja';
  const activity = report.activityName || 'Kegiatan';
  const amountStr = `Rp ${formatRupiahText(report.amountReceived)}`;
  const spentStr = `Rp ${formatRupiahText(report.totalSpent)}`;
  const dateStr = formatIndoDate(new Date().toISOString());

  const balance = (Number(report.amountReceived) || 0) - (Number(report.totalSpent) || 0);
  let balanceText = '';
  if (balance > 0) {
    balanceText = `Sisa Anggaran: Rp ${formatRupiahText(balance)} (Dikembalikan ke Kas)`;
  } else if (balance < 0) {
    balanceText = `Kekurangan/Defisit: Rp ${formatRupiahText(Math.abs(balance))} (Ditalangi Kas)`;
  } else {
    balanceText = `Sesuai Pagu (Pas/Nol)`;
  }

  const divider = '────────────────────────';
  const footer = `\n${divider}\n_Sistem Informasi Keuangan E-Lapor_\n*SMK Muhammadiyah 1 Ngadirejo*`;

  switch (status) {
    case ReportStatus.BUDGET_PROPOSAL:
      return `📩 *PENGAJUAN ANGGARAN BARU DITERIMA*\n*E-LAPOR BENDAHARA*\n${divider}\n` +
        `Pengajuan anggaran kegiatan Anda telah berhasil didaftarkan ke sistem dan sedang dalam antrean verifikasi Bendahara.\n\n` +
        `🏢 *Unit Kerja*: ${unit}\n` +
        `📌 *Kegiatan*: ${activity}\n` +
        `💰 *Nominal Diajukan*: ${amountStr}\n` +
        `📅 *Tanggal Pengajuan*: ${dateStr}\n\n` +
        `_Notifikasi status pengajuan selanjutnya akan otomatis dikirimkan ke nomor WhatsApp ini._${footer}`;

    case ReportStatus.BUDGET_APPROVED:
      return `🎉 *ANGGARAN TELAH DISETUJUI*\n*E-LAPOR BENDAHARA*\n${divider}\n` +
        `Kabar baik! Pengajuan anggaran kegiatan Anda telah *DISETUJUI* oleh Bendahara Sekolah.\n\n` +
        `🏢 *Unit Kerja*: ${unit}\n` +
        `📌 *Kegiatan*: ${activity}\n` +
        `💰 *Pagu Anggaran*: ${amountStr}\n` +
        `📅 *Tanggal Disetujui*: ${dateStr}\n` +
        (notes ? `📝 *Catatan Bendahara*: _"${notes}"_\n\n` : '\n') +
        `👉 *Langkah Selanjutnya*: Silakan laksanakan kegiatan sesuai RAB. Setelah kegiatan selesai, segera input rincian Laporan Pertanggungjawaban (LPJ) beserta nomor bukti transaksi di sistem E-Lapor.${footer}`;

    case ReportStatus.REPORTING:
      return `📋 *INSTRUKSI PENGISIAN LPJ (REALISASI)*\n*E-LAPOR BENDAHARA*\n${divider}\n` +
        `Status kegiatan Anda saat ini telah dibuka untuk *PENGISIAN REALISASI PENGELUARAN (LPJ)*.\n\n` +
        `🏢 *Unit Kerja*: ${unit}\n` +
        `📌 *Kegiatan*: ${activity}\n` +
        `💰 *Pagu Anggaran*: ${amountStr}\n` +
        (notes ? `📝 *Catatan Bendahara*: _"${notes}"_\n\n` : '\n') +
        `👉 Silakan login ke sistem E-Lapor untuk menginput rincian bukti transaksi riil kegiatan Anda.${footer}`;

    case ReportStatus.REVISION:
      return `⚠️ *PERINGATAN: PERMINTAAN REVISI LAPORAN*\n*E-LAPOR BENDAHARA*\n${divider}\n` +
        `Laporan/pengajuan kegiatan Anda membutuhkan *REVISI / PERBAIKAN* oleh Bendahara.\n\n` +
        `🏢 *Unit Kerja*: ${unit}\n` +
        `📌 *Kegiatan*: ${activity}\n` +
        `📝 *Catatan & Alasan Revisi*:\n👉 *"${notes || 'Mohon periksa dan perbaiki rincian anggaran/laporan'}"*\n\n` +
        `👉 Mohon segera membuka sistem E-Lapor dan lakukan perbaikan sesuai catatan Bendahara di atas.${footer}`;

    case ReportStatus.INCOMPLETE:
      return `⚠️ *PERINGATAN: LAPORAN BELUM LENGKAP*\n*E-LAPOR BENDAHARA*\n${divider}\n` +
        `Laporan realisasi kegiatan Anda tercatat *BELUM LENGKAP* (misal: belum ada pegawai pada pos belanja pegawai atau data nota belum lengkap).\n\n` +
        `🏢 *Unit Kerja*: ${unit}\n` +
        `📌 *Kegiatan*: ${activity}\n` +
        `📝 *Catatan Kekurangan*:\n👉 *"${notes || 'Lengkapi seluruh rincian dan bukti belanja kegiatan'}"*\n\n` +
        `👉 Silakan lengkapi laporan Anda di aplikasi E-Lapor.${footer}`;

    case ReportStatus.COMPLETED:
      return `✅ *LAPORAN DISETUJUI & DISAHKAN*\n*E-LAPOR BENDAHARA*\n${divider}\n` +
        `Alhamdulillah! Laporan Pertanggungjawaban (LPJ) kegiatan Anda telah *DISETUJUI & DISAHKAN (SELESAI)* oleh Bendahara Sekolah.\n\n` +
        `🏢 *Unit Kerja*: ${unit}\n` +
        `📌 *Kegiatan*: ${activity}\n` +
        `💰 *Pagu Anggaran*: ${amountStr}\n` +
        `💳 *Total Realisasi Belanja*: ${spentStr}\n` +
        `📊 *Posisi Kas Akhir*: ${balanceText}\n` +
        `📅 *Tanggal Pengesahan*: ${dateStr}\n` +
        (notes ? `📝 *Catatan Bendahara*: _"${notes}"_\n\n` : '\n') +
        `Terima kasih atas tertib administrasi dan kerja sama yang baik dalam pelaporan keuangan sekolah.${footer}`;

    case ReportStatus.ARCHIVED:
      return `📦 *LAPORAN RESMI DIARSIPKAN*\n*E-LAPOR BENDAHARA*\n${divider}\n` +
        `Laporan kegiatan *${activity}* (${unit}) telah resmi *DIARSIPKAN* dalam Buku Kas Induk Bendahara.\n\n` +
        `💰 *Realisasi Final*: ${spentStr}\n` +
        `📅 *Tanggal*: ${dateStr}${footer}`;

    case ReportStatus.REJECTED:
      return `❌ *PEMBERITAHUAN: PENGAJUAN DITOLAK*\n*E-LAPOR BENDAHARA*\n${divider}\n` +
        `Mohon maaf, pengajuan anggaran kegiatan Anda *TIDAK DISETUJUI / DITOLAK* oleh Bendahara.\n\n` +
        `🏢 *Unit Kerja*: ${unit}\n` +
        `📌 *Kegiatan*: ${activity}\n` +
        `📝 *Alasan Penolakan*:\n👉 *"${notes || 'Pengajuan tidak dapat disetujui'}"*\n\n` +
        `Silakan berkoordinasi langsung dengan Bendahara jika memerlukan informasi lebih lanjut.${footer}`;

    default:
      return `📢 *UPDATE STATUS KEGIATAN*\n*E-LAPOR BENDAHARA*\n${divider}\n` +
        `Status kegiatan *${activity}* (${unit}) telah diperbarui menjadi *${status}*.\n\n` +
        (notes ? `📝 *Catatan*: _"${notes}"_\n` : '') +
        `📅 *Waktu*: ${dateStr}${footer}`;
  }
}

/**
 * Mengirim notifikasi WhatsApp saat status laporan/kegiatan berubah
 */
export async function sendReportStatusNotification(
  report: Report,
  status: ReportStatus,
  notes?: string,
  db?: Firestore
): Promise<{ sent: boolean; message: string; details?: any }> {
  const phone = report.whatsappNumber;
  if (!phone || !phone.trim()) {
    return { sent: false, message: 'Nomor WhatsApp pengaju tidak dicantumkan pada kegiatan ini.' };
  }

  if (!db) {
    return { sent: false, message: 'Koneksi database Firestore tidak tersedia.' };
  }

  try {
    const settings = await getWhatsappSettings(db);
    if (!settings.enabled) {
      return { sent: false, message: 'Fitur notifikasi WhatsApp dinonaktifkan di pengaturan.' };
    }

    if (!settings.fonnteToken || !settings.fonnteToken.trim()) {
      return { sent: false, message: 'Token API Fonnte belum diisi di Pengaturan WhatsApp.' };
    }

    const messageText = buildStatusNotificationMessage(report, status, notes);
    const result = await sendFonnteMessage({
      token: settings.fonnteToken,
      target: phone,
      message: messageText
    });

    return {
      sent: result.success,
      message: result.message,
      details: result.response
    };
  } catch (err: any) {
    console.error('Error during sendReportStatusNotification:', err);
    return {
      sent: false,
      message: err.message || 'Gagal memproses notifikasi WhatsApp.'
    };
  }
}

/**
 * Mengirim kode OTP verifikasi ke nomor WhatsApp pengaju untuk memastikan nomor aktif
 */
export async function sendWhatsappVerificationCode({
  phone,
  code,
  unitName,
  activityName,
  db
}: {
  phone: string;
  code: string;
  unitName?: string;
  activityName?: string;
  db: Firestore;
}): Promise<{ success: boolean; message: string }> {
  try {
    const settings = await getWhatsappSettings(db);
    if (!settings.enabled) {
      return { success: false, message: 'Fitur notifikasi WhatsApp dinonaktifkan di pengaturan sistem.' };
    }
    if (!settings.fonnteToken || !settings.fonnteToken.trim()) {
      return { success: false, message: 'Token API WhatsApp belum dikonfigurasi oleh Bendahara.' };
    }

    const divider = '────────────────────────';
    const message = 
      `🔐 *VERIFIKASI NOMOR WHATSAPP AKTIF*\n` +
      `*E-LAPOR BENDAHARA*\n` +
      `${divider}\n` +
      `Kode verifikasi nomor WhatsApp Anda untuk pengajuan anggaran:\n\n` +
      `👉 *${code}*\n\n` +
      (unitName ? `🏢 *Unit*: ${unitName}\n` : '') +
      (activityName ? `📌 *Kegiatan*: ${activityName}\n` : '') +
      `\nMasukkan kode 6 digit ini pada formulir pengajuan anggaran untuk memverifikasi bahwa nomor WhatsApp Anda aktif dan siap menerima notifikasi status pengajuan hingga laporan selesai.\n` +
      `${divider}\n` +
      `_Sistem Informasi Keuangan E-Lapor SMK Muhammadiyah 1 Ngadirejo_`;

    const res = await sendFonnteMessage({
      token: settings.fonnteToken,
      target: phone,
      message
    });

    return {
      success: res.success,
      message: res.message
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Gagal mengirim kode verifikasi WhatsApp.'
    };
  }
}

