import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { Report, ReportStatus, WhatsappSettings } from '../types';

export type { WhatsappSettings };

// Flag global untuk mengaktifkan/menonaktifkan notifikasi WhatsApp secara instan
export const WHATSAPP_TEMPORARILY_DISABLED = false;

export const DEFAULT_WABA_API_VERSION = 'v21.0';
export const DEFAULT_STATUS_TEMPLATE_NAME = 'elapor_notifikasi_status';
export const DEFAULT_OTP_TEMPLATE_NAME = 'elapor_verifikasi_otp';
export const DEFAULT_OTP_UTILITY_TEMPLATE_NAME = 'elapor_verifikasi_kode';

export const STATUS_TEMPLATE_PRESET_BODY =
  `Pemberitahuan Status E-Lapor Bendahara ({{1}})\n\n` +
  `Unit Kerja: {{2}}\n` +
  `Kegiatan: {{3}}\n` +
  `Nominal / Realisasi: {{4}}\n` +
  `Keterangan: {{5}}\n` +
  `Catatan Bendahara: {{6}}\n\n` +
  `Silakan buka sistem E-Lapor SMK Muhammadiyah 1 Ngadirejo untuk melihat rincian dan tindak lanjut.`;

export const STATUS_TEMPLATE_PRESET_EXAMPLES = [
  'Anggaran Disetujui',
  'Kurikulum',
  'Workshop Kurikulum Merdeka',
  'Rp 5.000.000',
  'Pengajuan anggaran disetujui oleh Bendahara. Silakan koordinasi jadwal pelaksanaan.',
  'Harap melampirkan nota asli saat pelaporan'
];

export const OTP_UTILITY_TEMPLATE_BODY =
  `Kode verifikasi WhatsApp E-Lapor Bendahara Anda adalah *{{1}}*.\n\n` +
  `Masukkan kode 6 digit ini pada form pengajuan anggaran. Demi keamanan, jangan bagikan kode ini kepada siapa pun.`;

export const OTP_UTILITY_TEMPLATE_EXAMPLES = ['482910'];

export const DEFAULT_WHATSAPP_SETTINGS: WhatsappSettings = {
  enabled: true,
  wabaAccessToken: '',
  wabaPhoneNumberId: '',
  wabaAccountId: '',
  wabaApiVersion: DEFAULT_WABA_API_VERSION,
  statusTemplateName: DEFAULT_STATUS_TEMPLATE_NAME,
  statusTemplateLanguage: 'id',
  otpTemplateName: DEFAULT_OTP_TEMPLATE_NAME,
  otpTemplateLanguage: 'id',
  otpTemplateMode: 'AUTHENTICATION',
  requireOtpVerification: false,
  senderName: 'Bendahara SMK MUH 1 NGADIREJO',
  schoolName: 'SMK MUHAMMADIYAH 1 NGADIREJO'
};

export interface WabaTemplateRecord {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  rejected_reason?: string;
  components?: any[];
}

export interface WabaTemplateSubmission {
  accessToken: string;
  wabaAccountId: string;
  apiVersion?: string;
  name: string;
  category: 'UTILITY' | 'AUTHENTICATION' | 'MARKETING';
  language: string;
  headerText?: string;
  headerExample?: string;
  bodyText?: string;
  bodyExamples?: string[];
  footerText?: string;
  addSecurityRecommendation?: boolean;
  codeExpirationMinutes?: number;
  otpButtonText?: string;
}

/**
 * Format string nomor HP menjadi format E.164 tanpa '+' untuk Meta WABA Official
 * Contoh: '0812-3456-7890' -> '6281234567890', '+628123...' -> '628123...'
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return '';

  if (cleaned.startsWith('0')) {
    return '62' + cleaned.slice(1);
  }
  if (cleaned.startsWith('8')) {
    return '62' + cleaned;
  }
  return cleaned;
}

/**
 * Membersihkan parameter teks untuk Meta WABA Template API.
 * Meta Cloud API menolak parameter yang kosong ("") atau mengandung newline (\n/\r), tab (\t), atau >4 spasi beruntun.
 */
export function sanitizeWabaParam(val?: string | number | null): string {
  if (val === null || val === undefined) return '-';
  const cleaned = String(val)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!cleaned) return '-';
  return cleaned.length > 900 ? cleaned.slice(0, 897) + '...' : cleaned;
}

/**
 * Membersihkan Access Token Meta WABA dari prefix 'Bearer ', 'access_token=', tanda kutip, spasi, newline, atau karakter tersembunyi.
 * Mencegah error Meta Graph API: "Invalid OAuth access token - Cannot parse access token".
 */
export function sanitizeWabaToken(rawToken?: string | null): string {
  if (!rawToken) return '';
  let token = String(rawToken).trim();
  // Hapus tanda kutip pembungkus jika ikut tersalin
  token = token.replace(/^["'`]+|["'`]+$/g, '').trim();
  // Hapus prefix "Bearer " atau "access_token=" jika ikut tersalin dari dokumentasi cURL/URL Meta
  token = token.replace(/^(bearer\s+)+/i, '').trim();
  token = token.replace(/^access_token=/i, '').trim();
  token = token.replace(/^["'`]+|["'`]+$/g, '').trim();
  // Hapus semua whitespace, newline, tab, dan zero-width chars
  token = token.replace(/[\s\u200B-\u200D\uFEFF]+/g, '');
  return token;
}

/**
 * Membersihkan ID numerik Meta (Phone Number ID / WABA ID) dari spasi atau karakter non-alfanumerik
 */
export function sanitizeWabaId(rawId?: string | null): string {
  if (!rawId) return '';
  return String(rawId).replace(/[\s\u200B-\u200D\uFEFF]+/g, '').trim();
}

/**
 * Menormalkan versi Meta Graph API agar selalu diawali 'v' (misal '21.0' -> 'v21.0')
 */
export function normalizeWabaApiVersion(rawVersion?: string | null): string {
  const cleaned = (rawVersion || DEFAULT_WABA_API_VERSION).trim();
  if (!cleaned) return DEFAULT_WABA_API_VERSION;
  return /^v\d+/i.test(cleaned) ? cleaned.toLowerCase() : `v${cleaned}`;
}

/**
 * Memformat pesan error dari Meta Graph API agar mudah dipahami admin,
 * termasuk penanganan khusus untuk error OAuth token (code 190 / Cannot parse access token).
 */
export function formatMetaApiError(data: any, fallbackMessage: string): string {
  const rawMsg: string =
    data?.error?.error_user_msg ||
    data?.error?.message ||
    fallbackMessage;
  const code = data?.error?.code;
  const subcode = data?.error?.error_subcode;

  if (
    code === 190 ||
    /cannot parse access token/i.test(rawMsg) ||
    /invalid oauth access token/i.test(rawMsg)
  ) {
    return (
      `${rawMsg}. ` +
      `Pastikan Anda memasukkan Access Token Meta WhatsApp Cloud API yang valid (biasanya diawali "EAA..."), ` +
      `tanpa kata "Bearer ", tanpa spasi/baris baru/tanda kutip, serta bukan token Fonnte atau App Secret. ` +
      `Untuk pemakaian permanen, buat token di Meta Business Suite -> Pengaturan Bisnis -> Pengguna Sistem (System Users) dengan izin "whatsapp_business_messaging" & "whatsapp_business_management".`
    );
  }

  if (
    code === 10 ||
    subcode === 2388185 ||
    /does not have permission to create message template/i.test(rawMsg) ||
    /application does not have permission for this action/i.test(rawMsg)
  ) {
    return (
      `${rawMsg} (Kode: ${code ?? '-'} / Subkode: ${subcode ?? '-'}). ` +
      `Penyebab umum: (1) Anda memakai Akun/Nomor Uji Coba Sandbox Meta (Test WhatsApp Business Account) yang dibatasi membuat template lewat API, ` +
      `atau (2) System User / Token belum diberi akses Kontrol Penuh (Manage) atas Akun WhatsApp (WABA) dan scope "whatsapp_business_management" di Meta Business Suite. ` +
      `Anda juga bisa membuat template langsung di Meta WhatsApp Manager lalu klik "Muat / Segarkan Status Template" di aplikasi ini.`
    );
  }

  return rawMsg;
}

/**
 * Memvalidasi format dasar token sebelum dikirim ke Meta Graph API
 */
function validateTokenBeforeRequest(rawToken?: string | null): { valid: boolean; token: string; message?: string } {
  const token = sanitizeWabaToken(rawToken);
  if (!token) {
    return { valid: false, token: '', message: 'Access Token WABA Official belum diisi.' };
  }
  if (/[^\x21-\x7E]/.test(token)) {
    return {
      valid: false,
      token,
      message: 'Access Token mengandung karakter tidak valid atau karakter tersembunyi. Salin ulang token EAA... dari Meta Developer / Business Manager.'
    };
  }
  if (token.length < 30) {
    return {
      valid: false,
      token,
      message: 'Format Access Token WABA terlalu pendek / tidak lengkap. Token Meta Cloud API resmi umumnya panjang dan diawali "EAA...".'
    };
  }
  return { valid: true, token };
}

/**
 * Mengambil konfigurasi WhatsApp WABA Official dari Firestore
 */
export async function getWhatsappSettings(db: Firestore): Promise<WhatsappSettings> {
  try {
    const docRef = doc(db, 'settings', 'whatsapp');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const merged = { ...DEFAULT_WHATSAPP_SETTINGS, ...snap.data() } as WhatsappSettings;
      return {
        ...merged,
        wabaAccessToken: sanitizeWabaToken(merged.wabaAccessToken),
        wabaPhoneNumberId: sanitizeWabaId(merged.wabaPhoneNumberId),
        wabaAccountId: sanitizeWabaId(merged.wabaAccountId),
        wabaApiVersion: normalizeWabaApiVersion(merged.wabaApiVersion)
      };
    }
  } catch (e) {
    console.warn('Failed to fetch whatsapp settings from firestore:', e);
  }

  const envToken = sanitizeWabaToken((import.meta as any).env?.VITE_WABA_ACCESS_TOKEN || '');
  const envPhoneId = sanitizeWabaId((import.meta as any).env?.VITE_WABA_PHONE_NUMBER_ID || '');
  const envWabaId = sanitizeWabaId((import.meta as any).env?.VITE_WABA_ACCOUNT_ID || '');
  return {
    ...DEFAULT_WHATSAPP_SETTINGS,
    wabaAccessToken: envToken,
    wabaPhoneNumberId: envPhoneId,
    wabaAccountId: envWabaId
  };
}

/**
 * Menyimpan konfigurasi WhatsApp WABA Official ke Firestore
 */
export async function saveWhatsappSettings(
  db: Firestore,
  settings: Partial<WhatsappSettings>,
  userEmail?: string
): Promise<void> {
  const docRef = doc(db, 'settings', 'whatsapp');
  const sanitizedPayload: Partial<WhatsappSettings> = {
    ...settings
  };
  if (settings.wabaAccessToken !== undefined) {
    sanitizedPayload.wabaAccessToken = sanitizeWabaToken(settings.wabaAccessToken);
  }
  if (settings.wabaPhoneNumberId !== undefined) {
    sanitizedPayload.wabaPhoneNumberId = sanitizeWabaId(settings.wabaPhoneNumberId);
  }
  if (settings.wabaAccountId !== undefined) {
    sanitizedPayload.wabaAccountId = sanitizeWabaId(settings.wabaAccountId);
  }
  if (settings.wabaApiVersion !== undefined) {
    sanitizedPayload.wabaApiVersion = normalizeWabaApiVersion(settings.wabaApiVersion);
  }
  await setDoc(
    docRef,
    {
      ...sanitizedPayload,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail || 'admin'
    },
    { merge: true }
  );
}

/**
 * Mengecek validitas Access Token, Phone Number ID, dan WABA Account ID ke Meta Graph API
 */
export async function verifyWabaConnection({
  accessToken,
  phoneNumberId,
  wabaAccountId,
  apiVersion = DEFAULT_WABA_API_VERSION
}: {
  accessToken: string;
  phoneNumberId?: string;
  wabaAccountId?: string;
  apiVersion?: string;
}): Promise<{
  success: boolean;
  message: string;
  phoneInfo?: { id: string; display_phone_number?: string; verified_name?: string; quality_rating?: string };
  wabaInfo?: { id: string; name?: string; currency?: string };
}> {
  const tokenCheck = validateTokenBeforeRequest(accessToken);
  if (!tokenCheck.valid) {
    return { success: false, message: tokenCheck.message || 'Access Token tidak valid.' };
  }
  const cleanPhoneId = sanitizeWabaId(phoneNumberId);
  const cleanWabaId = sanitizeWabaId(wabaAccountId);
  const version = normalizeWabaApiVersion(apiVersion);

  if (!cleanPhoneId && !cleanWabaId) {
    return {
      success: false,
      message: 'Isi Phone Number ID atau WABA Account ID terlebih dahulu untuk menguji koneksi.'
    };
  }

  let phoneInfo: any;
  let wabaInfo: any;
  const parts: string[] = [];

  try {
    if (cleanPhoneId) {
      const phoneRes = await fetch(
        `https://graph.facebook.com/${version}/${cleanPhoneId}?fields=id,display_phone_number,verified_name,quality_rating`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${tokenCheck.token}` }
        }
      );
      const phoneData = await phoneRes.json();
      if (!phoneRes.ok) {
        return {
          success: false,
          message: formatMetaApiError(phoneData, 'Gagal memverifikasi Token & Phone Number ID.')
        };
      }
      phoneInfo = phoneData;
      parts.push(`Nomor WA: ${phoneData.display_phone_number || phoneData.id} (${phoneData.verified_name || 'Terhubung'})`);
    }

    if (cleanWabaId) {
      const wabaRes = await fetch(
        `https://graph.facebook.com/${version}/${cleanWabaId}?fields=id,name,currency`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${tokenCheck.token}` }
        }
      );
      const wabaData = await wabaRes.json();
      if (!wabaRes.ok) {
        return {
          success: false,
          message: formatMetaApiError(wabaData, 'Token valid untuk nomor, tetapi gagal mengakses WABA Account ID.')
        };
      }
      wabaInfo = wabaData;
      parts.push(`Akun WABA: ${wabaData.name || wabaData.id}`);
    }

    return {
      success: true,
      message: `Koneksi WABA Official Valid! ${parts.join(' • ')}`,
      phoneInfo,
      wabaInfo
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Kesalahan jaringan saat menghubungi Meta Graph API.'
    };
  }
}

/**
 * Kirim pesan template resmi melalui Meta WhatsApp Business Cloud API (WABA Official)
 */
export async function sendWabaTemplateMessage({
  accessToken,
  phoneNumberId,
  apiVersion = DEFAULT_WABA_API_VERSION,
  target,
  templateName,
  languageCode = 'id',
  headerParams,
  bodyParams,
  buttonUrlParams
}: {
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string;
  target: string;
  templateName: string;
  languageCode?: string;
  headerParams?: string[];
  bodyParams?: string[];
  buttonUrlParams?: string[];
}): Promise<{ success: boolean; message: string; response?: any }> {
  const tokenCheck = validateTokenBeforeRequest(accessToken);
  if (!tokenCheck.valid) {
    return { success: false, message: tokenCheck.message || 'Access Token WABA Official belum dikonfigurasi.' };
  }
  const cleanPhoneId = sanitizeWabaId(phoneNumberId);
  if (!cleanPhoneId) {
    return { success: false, message: 'Phone Number ID WABA Official belum dikonfigurasi.' };
  }
  if (!templateName || !templateName.trim()) {
    return { success: false, message: 'Nama template WABA belum diisi.' };
  }

  const cleanTarget = formatPhoneNumber(target);
  if (!cleanTarget || cleanTarget.length < 9) {
    return { success: false, message: 'Nomor WhatsApp tujuan tidak valid.' };
  }

  const components: any[] = [];
  if (headerParams && headerParams.length > 0) {
    components.push({
      type: 'header',
      parameters: headerParams.map(p => ({ type: 'text', text: sanitizeWabaParam(p) }))
    });
  }
  if (bodyParams && bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map(p => ({ type: 'text', text: sanitizeWabaParam(p) }))
    });
  }
  if (buttonUrlParams && buttonUrlParams.length > 0) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: buttonUrlParams.map(p => ({ type: 'text', text: sanitizeWabaParam(p) }))
    });
  }

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanTarget,
    type: 'template',
    template: {
      name: templateName.trim(),
      language: { code: languageCode.trim() || 'id' }
    }
  };
  if (components.length > 0) {
    payload.template.components = components;
  }

  try {
    const version = normalizeWabaApiVersion(apiVersion);
    const url = `https://graph.facebook.com/${version}/${cleanPhoneId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenCheck.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data?.messages?.[0]?.id) {
      return {
        success: true,
        message: `Pesan template "${templateName}" berhasil dikirim via WABA Official.`,
        response: data
      };
    } else {
      return {
        success: false,
        message: formatMetaApiError(data, 'Gagal mengirim pesan template melalui Meta WABA Official.'),
        response: data
      };
    }
  } catch (error: any) {
    console.error('Error sending WhatsApp template via WABA Official:', error);
    return {
      success: false,
      message: error.message || 'Terjadi kesalahan jaringan saat menghubungi Meta Graph API.'
    };
  }
}

/**
 * Kirim pesan teks bebas melalui Meta WABA Official (berlaku dalam jendela layanan 24 jam)
 */
export async function sendWabaTextMessage({
  accessToken,
  phoneNumberId,
  apiVersion = DEFAULT_WABA_API_VERSION,
  target,
  message
}: {
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string;
  target: string;
  message: string;
}): Promise<{ success: boolean; message: string; response?: any }> {
  const tokenCheck = validateTokenBeforeRequest(accessToken);
  if (!tokenCheck.valid) {
    return { success: false, message: tokenCheck.message || 'Access Token WABA Official belum dikonfigurasi.' };
  }
  const cleanPhoneId = sanitizeWabaId(phoneNumberId);
  if (!cleanPhoneId) {
    return { success: false, message: 'Phone Number ID WABA Official belum dikonfigurasi.' };
  }

  const cleanTarget = formatPhoneNumber(target);
  if (!cleanTarget || cleanTarget.length < 9) {
    return { success: false, message: 'Nomor WhatsApp tujuan tidak valid.' };
  }

  try {
    const version = normalizeWabaApiVersion(apiVersion);
    const url = `https://graph.facebook.com/${version}/${cleanPhoneId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenCheck.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTarget,
        type: 'text',
        text: {
          preview_url: false,
          body: message
        }
      })
    });

    const data = await res.json();
    if (res.ok && data?.messages?.[0]?.id) {
      return {
        success: true,
        message: 'Pesan teks berhasil dikirim via WABA Official.',
        response: data
      };
    } else {
      return {
        success: false,
        message: formatMetaApiError(data, 'Gagal mengirim pesan teks melalui Meta WABA Official.'),
        response: data
      };
    }
  } catch (error: any) {
    console.error('Error sending WhatsApp text via WABA Official:', error);
    return {
      success: false,
      message: error.message || 'Terjadi kesalahan jaringan saat menghubungi Meta Graph API.'
    };
  }
}

/**
 * Mengajukan pembuatan Template Pesan baru ke Meta WABA Official
 */
export async function submitWabaTemplate(
  input: WabaTemplateSubmission
): Promise<{ success: boolean; message: string; templateId?: string; status?: string; response?: any }> {
  const {
    accessToken,
    wabaAccountId,
    apiVersion = DEFAULT_WABA_API_VERSION,
    name,
    category,
    language,
    headerText,
    headerExample,
    bodyText,
    bodyExamples,
    footerText,
    addSecurityRecommendation = true,
    codeExpirationMinutes = 10,
    otpButtonText = 'Salin Kode'
  } = input;

  const tokenCheck = validateTokenBeforeRequest(accessToken);
  if (!tokenCheck.valid) {
    return {
      success: false,
      message: tokenCheck.message || 'Access Token WABA Official tidak valid.'
    };
  }
  const cleanWabaId = sanitizeWabaId(wabaAccountId);
  if (!cleanWabaId) {
    return {
      success: false,
      message: 'WhatsApp Business Account ID (WABA ID) wajib diisi untuk mengajukan template.'
    };
  }

  const sanitizedName = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (!sanitizedName) {
    return { success: false, message: 'Nama template wajib diisi (huruf kecil, angka, dan underscore).' };
  }

  const components: any[] = [];

  if (category === 'AUTHENTICATION') {
    components.push({
      type: 'BODY',
      add_security_recommendation: Boolean(addSecurityRecommendation)
    });
    if (codeExpirationMinutes && codeExpirationMinutes > 0) {
      components.push({
        type: 'FOOTER',
        code_expiration_minutes: Math.min(90, Math.max(1, Number(codeExpirationMinutes)))
      });
    }
    components.push({
      type: 'BUTTONS',
      buttons: [
        {
          type: 'OTP',
          otp_type: 'COPY_CODE',
          text: otpButtonText?.trim() || 'Salin Kode'
        }
      ]
    });
  } else {
    if (headerText && headerText.trim()) {
      const headerComp: any = {
        type: 'HEADER',
        format: 'TEXT',
        text: headerText.trim()
      };
      if (/\{\{\d+\}\}/.test(headerText)) {
        headerComp.example = {
          header_text: [headerExample?.trim() || 'Informasi E-Lapor']
        };
      }
      components.push(headerComp);
    }

    if (!bodyText || !bodyText.trim()) {
      return { success: false, message: 'Isi pesan template (Body) tidak boleh kosong.' };
    }

    const bodyComp: any = {
      type: 'BODY',
      text: bodyText.trim()
    };

    const matches = bodyText.match(/\{\{\d+\}\}/g);
    if (matches && matches.length > 0) {
      const uniqueVars = Array.from(new Set(matches));
      const examples = uniqueVars.map((_, idx) => bodyExamples?.[idx]?.trim() || `Contoh_${idx + 1}`);
      bodyComp.example = {
        body_text: [examples]
      };
    }
    components.push(bodyComp);

    if (footerText && footerText.trim()) {
      components.push({
        type: 'FOOTER',
        text: footerText.trim()
      });
    }
  }

  const payload: any = {
    name: sanitizedName,
    language: language || 'id',
    category,
    components
  };

  if (category !== 'AUTHENTICATION') {
    payload.parameter_format = 'POSITIONAL';
  }

  try {
    const version = normalizeWabaApiVersion(apiVersion);
    const url = `https://graph.facebook.com/${version}/${cleanWabaId}/message_templates`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenCheck.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data?.id) {
      return {
        success: true,
        message: `Template "${sanitizedName}" berhasil diajukan ke Meta WABA Official (Status: ${data.status || 'PENDING'}).`,
        templateId: data.id,
        status: data.status || 'PENDING',
        response: data
      };
    } else {
      return {
        success: false,
        message: formatMetaApiError(data, 'Gagal mengajukan template ke Meta WABA Official.'),
        response: data
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Terjadi kesalahan jaringan saat mengajukan template ke Meta Graph API.'
    };
  }
}

/**
 * Mengambil daftar template beserta status persetujuannya dari Meta WABA Official
 */
export async function fetchWabaTemplates({
  accessToken,
  wabaAccountId,
  apiVersion = DEFAULT_WABA_API_VERSION
}: {
  accessToken: string;
  wabaAccountId: string;
  apiVersion?: string;
}): Promise<{ success: boolean; templates: WabaTemplateRecord[]; message: string }> {
  const tokenCheck = validateTokenBeforeRequest(accessToken);
  if (!tokenCheck.valid) {
    return {
      success: false,
      templates: [],
      message: tokenCheck.message || 'Access Token WABA Official tidak valid.'
    };
  }
  const cleanWabaId = sanitizeWabaId(wabaAccountId);
  if (!cleanWabaId) {
    return {
      success: false,
      templates: [],
      message: 'WABA Account ID wajib diisi untuk melihat daftar template.'
    };
  }

  try {
    const version = normalizeWabaApiVersion(apiVersion);
    const url = `https://graph.facebook.com/${version}/${cleanWabaId}/message_templates?fields=id,name,status,category,language,components,rejected_reason&limit=50`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenCheck.token}`
      }
    });

    const data = await res.json();
    if (res.ok && Array.isArray(data?.data)) {
      return {
        success: true,
        templates: data.data as WabaTemplateRecord[],
        message: `Berhasil memuat ${data.data.length} template dari WABA Official.`
      };
    } else {
      return {
        success: false,
        templates: [],
        message: formatMetaApiError(data, 'Gagal mengambil daftar template WABA Official.')
      };
    }
  } catch (error: any) {
    return {
      success: false,
      templates: [],
      message: error.message || 'Kesalahan jaringan saat mengambil daftar template WABA.'
    };
  }
}

/**
 * Menghapus template pesan di Meta WABA Official berdasarkan nama template
 */
export async function deleteWabaTemplate({
  accessToken,
  wabaAccountId,
  apiVersion = DEFAULT_WABA_API_VERSION,
  templateName
}: {
  accessToken: string;
  wabaAccountId: string;
  apiVersion?: string;
  templateName: string;
}): Promise<{ success: boolean; message: string }> {
  const tokenCheck = validateTokenBeforeRequest(accessToken);
  if (!tokenCheck.valid) {
    return { success: false, message: tokenCheck.message || 'Access Token tidak valid.' };
  }
  const cleanWabaId = sanitizeWabaId(wabaAccountId);
  if (!cleanWabaId || !templateName?.trim()) {
    return { success: false, message: 'Parameter hapus template belum lengkap.' };
  }
  try {
    const version = normalizeWabaApiVersion(apiVersion);
    const url = `https://graph.facebook.com/${version}/${cleanWabaId}/message_templates?name=${encodeURIComponent(templateName.trim())}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${tokenCheck.token}`
      }
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return { success: true, message: `Template "${templateName}" berhasil dihapus dari WABA.` };
    }
    return {
      success: false,
      message: formatMetaApiError(data, 'Gagal menghapus template WABA.')
    };
  } catch (error: any) {
    return { success: false, message: error.message || 'Kesalahan jaringan saat menghapus template.' };
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
 * Menghasilkan 6 parameter terstruktur untuk template WABA Official `elapor_notifikasi_status`
 * {{1}} Status Judul, {{2}} Unit Kerja, {{3}} Kegiatan, {{4}} Nominal/Realisasi, {{5}} Keterangan, {{6}} Catatan Bendahara
 */
export function buildStatusTemplateParams(
  report: Report,
  status: ReportStatus,
  notes?: string
): string[] {
  const unit = sanitizeWabaParam(report.unitName || 'Unit Kerja');
  const activity = sanitizeWabaParam(report.activityName || 'Kegiatan');
  const amountStr = `Rp ${formatRupiahText(report.amountReceived)}`;
  const spentStr = `Rp ${formatRupiahText(report.totalSpent)}`;
  const noteVal = sanitizeWabaParam(notes !== undefined ? notes : report.treasurerNotes);

  const balance = (Number(report.amountReceived) || 0) - (Number(report.totalSpent) || 0);
  let balanceText = '';
  if (balance > 0) {
    balanceText = `Sisa Rp ${formatRupiahText(balance)}`;
  } else if (balance < 0) {
    balanceText = `Kekurangan Rp ${formatRupiahText(Math.abs(balance))}`;
  } else {
    balanceText = 'Pas/Nol';
  }

  switch (status) {
    case ReportStatus.BUDGET_PROPOSAL:
      return [
        'Pengajuan Anggaran Diterima',
        unit,
        activity,
        amountStr,
        'Pengajuan anggaran baru telah diterima dan masuk antrean verifikasi Bendahara.',
        noteVal
      ];
    case ReportStatus.BUDGET_APPROVED:
      return [
        'Anggaran Disetujui',
        unit,
        activity,
        amountStr,
        'Pengajuan anggaran disetujui oleh Bendahara. Silakan koordinasi jadwal pelaksanaan & pencairan.',
        noteVal
      ];
    case ReportStatus.REPORTING:
      return [
        'Anggaran Dicairkan / Instruksi LPJ',
        unit,
        activity,
        amountStr,
        'Dana anggaran sudah dicairkan/diinstruksikan. Silakan input rincian realisasi & nomor bukti di E-Lapor.',
        noteVal
      ];
    case ReportStatus.REVISION:
      return [
        'Permintaan Revisi',
        unit,
        activity,
        amountStr,
        'Pengajuan atau laporan memerlukan perbaikan sesuai catatan Bendahara.',
        noteVal
      ];
    case ReportStatus.INCOMPLETE:
      return [
        'Laporan Belum Lengkap',
        unit,
        activity,
        amountStr,
        'Rincian laporan realisasi belum lengkap (cek nomor bukti atau penerima belanja pegawai).',
        noteVal
      ];
    case ReportStatus.COMPLETED:
      return [
        'Laporan Disetujui & Disahkan',
        unit,
        activity,
        `Pagu ${amountStr} | Realisasi ${spentStr} | ${balanceText}`,
        'LPJ kegiatan telah disetujui dan disahkan oleh Bendahara Sekolah.',
        noteVal
      ];
    case ReportStatus.REJECTED:
      return [
        'Pengajuan Ditolak',
        unit,
        activity,
        amountStr,
        'Mohon maaf pengajuan anggaran tidak disetujui. Hubungi Bendahara untuk informasi lanjut.',
        noteVal
      ];
    default:
      return [
        `Update Status (${status})`,
        unit,
        activity,
        amountStr,
        'Status kegiatan di sistem E-Lapor telah diperbarui.',
        noteVal
      ];
  }
}

/**
 * Menghasilkan pratinjau teks notifikasi WhatsApp berdasarkan status kegiatan
 */
export function buildStatusNotificationMessage(
  report: Report,
  status: ReportStatus,
  notes?: string
): string {
  const [title, unit, activity, nominal, desc, noteVal] = buildStatusTemplateParams(report, status, notes);
  const dateStr = formatIndoDate(new Date().toISOString());
  if (status === ReportStatus.ARCHIVED) return '';

  return (
    `*E-LAPOR BENDAHARA: ${title}*\n` +
    `Unit Kerja: ${unit}\n` +
    `Kegiatan: ${activity}\n` +
    `Nominal: ${nominal}\n` +
    `Tanggal: ${dateStr}\n` +
    `Keterangan: ${desc}\n` +
    `Catatan Bendahara: ${noteVal}\n\n` +
    `_Sistem Informasi Keuangan E-Lapor SMK Muhammadiyah 1 Ngadirejo_`
  );
}

/**
 * Mengirim notifikasi WhatsApp WABA Official saat status laporan/kegiatan berubah
 */
export async function sendReportStatusNotification(
  report: Report,
  status: ReportStatus,
  notes?: string,
  db?: Firestore
): Promise<{ sent: boolean; message: string; details?: any }> {
  if (WHATSAPP_TEMPORARILY_DISABLED) {
    return {
      sent: false,
      message: 'Notifikasi WhatsApp dinonaktifkan sementara.'
    };
  }

  // Notifikasi WhatsApp ditiadakan saat Laporan Resmi Diarsipkan oleh bendahara.
  if (status === ReportStatus.ARCHIVED) {
    return {
      sent: false,
      message: 'Notifikasi WhatsApp ditiadakan untuk status Laporan Resmi Diarsipkan.'
    };
  }

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

    if (!settings.wabaAccessToken?.trim() || !settings.wabaPhoneNumberId?.trim()) {
      return {
        sent: false,
        message: 'Kredensial WABA Official (Access Token / Phone Number ID) belum diisi di Pengaturan WhatsApp.'
      };
    }

    const bodyParams = buildStatusTemplateParams(report, status, notes);
    const result = await sendWabaTemplateMessage({
      accessToken: settings.wabaAccessToken,
      phoneNumberId: settings.wabaPhoneNumberId,
      apiVersion: settings.wabaApiVersion || DEFAULT_WABA_API_VERSION,
      target: phone,
      templateName: settings.statusTemplateName || DEFAULT_STATUS_TEMPLATE_NAME,
      languageCode: settings.statusTemplateLanguage || 'id',
      bodyParams
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
      message: err.message || 'Gagal memproses notifikasi WhatsApp WABA Official.'
    };
  }
}

/**
 * Pengajuan cepat 1-klik untuk preset template resmi E-Lapor (Status, OTP Auth, atau OTP Teks Sederhana)
 */
export async function quickSubmitTemplatePreset({
  preset,
  accessToken,
  wabaAccountId,
  apiVersion = DEFAULT_WABA_API_VERSION,
  language = 'id'
}: {
  preset: 'status' | 'otp_auth' | 'otp_utility';
  accessToken: string;
  wabaAccountId: string;
  apiVersion?: string;
  language?: string;
}) {
  if (preset === 'otp_auth') {
    return submitWabaTemplate({
      accessToken,
      wabaAccountId,
      apiVersion,
      name: DEFAULT_OTP_TEMPLATE_NAME,
      category: 'AUTHENTICATION',
      language,
      addSecurityRecommendation: true,
      codeExpirationMinutes: 10,
      otpButtonText: 'Salin Kode'
    });
  }

  if (preset === 'otp_utility') {
    return submitWabaTemplate({
      accessToken,
      wabaAccountId,
      apiVersion,
      name: DEFAULT_OTP_UTILITY_TEMPLATE_NAME,
      category: 'UTILITY',
      language,
      bodyText: OTP_UTILITY_TEMPLATE_BODY,
      bodyExamples: OTP_UTILITY_TEMPLATE_EXAMPLES,
      footerText: 'E-Lapor SMK Muhammadiyah 1 Ngadirejo'
    });
  }

  return submitWabaTemplate({
    accessToken,
    wabaAccountId,
    apiVersion,
    name: DEFAULT_STATUS_TEMPLATE_NAME,
    category: 'UTILITY',
    language,
    bodyText: STATUS_TEMPLATE_PRESET_BODY,
    bodyExamples: STATUS_TEMPLATE_PRESET_EXAMPLES,
    footerText: 'Sistem Informasi Keuangan E-Lapor SMK Muh 1 Ngadirejo'
  });
}

/**
 * Mengirim kode OTP verifikasi menggunakan pengaturan langsung (berguna untuk uji coba maupun alur pengajuan)
 */
export async function sendOtpWithWabaSettings({
  settings,
  phone,
  code
}: {
  settings: WhatsappSettings;
  phone: string;
  code: string;
}): Promise<{ success: boolean; message: string; response?: any }> {
  const mode = settings.otpTemplateMode || 'AUTHENTICATION';
  const templateName = settings.otpTemplateName || (mode === 'UTILITY' ? DEFAULT_OTP_UTILITY_TEMPLATE_NAME : DEFAULT_OTP_TEMPLATE_NAME);
  const languageCode = settings.otpTemplateLanguage || 'id';

  if (mode === 'UTILITY') {
    return sendWabaTemplateMessage({
      accessToken: settings.wabaAccessToken,
      phoneNumberId: settings.wabaPhoneNumberId,
      apiVersion: settings.wabaApiVersion || DEFAULT_WABA_API_VERSION,
      target: phone,
      templateName,
      languageCode,
      bodyParams: [code]
    });
  }

  // Mode AUTHENTICATION (Meta Copy Code OTP membutuhkan bodyParams & buttonUrlParams)
  const res = await sendWabaTemplateMessage({
    accessToken: settings.wabaAccessToken,
    phoneNumberId: settings.wabaPhoneNumberId,
    apiVersion: settings.wabaApiVersion || DEFAULT_WABA_API_VERSION,
    target: phone,
    templateName,
    languageCode,
    bodyParams: [code],
    buttonUrlParams: [code]
  });

  // Fallback otomatis jika ternyata template di Meta bertipe teks/tanpa tombol OTP
  const errCode = res.response?.error?.code;
  const errMsg = String(res.response?.error?.message || res.message || '');
  if (!res.success && (errCode === 132000 || errCode === 132012 || /button|parameter/i.test(errMsg))) {
    const retryRes = await sendWabaTemplateMessage({
      accessToken: settings.wabaAccessToken,
      phoneNumberId: settings.wabaPhoneNumberId,
      apiVersion: settings.wabaApiVersion || DEFAULT_WABA_API_VERSION,
      target: phone,
      templateName,
      languageCode,
      bodyParams: [code]
    });
    if (retryRes.success) return retryRes;
  }

  return res;
}

/**
 * Mengirim kode OTP verifikasi ke nomor WhatsApp pengaju melalui Template WABA Official
 */
export async function sendWhatsappVerificationCode({
  phone,
  code,
  db
}: {
  phone: string;
  code: string;
  unitName?: string;
  activityName?: string;
  db: Firestore;
}): Promise<{ success: boolean; message: string }> {
  if (WHATSAPP_TEMPORARILY_DISABLED) {
    return {
      success: false,
      message: 'Verifikasi WhatsApp dinonaktifkan sementara.'
    };
  }

  try {
    const settings = await getWhatsappSettings(db);
    if (!settings.enabled) {
      return { success: false, message: 'Fitur notifikasi WhatsApp dinonaktifkan di pengaturan sistem.' };
    }
    if (!settings.wabaAccessToken?.trim() || !settings.wabaPhoneNumberId?.trim()) {
      return {
        success: false,
        message: 'Kredensial WABA Official belum dikonfigurasi oleh Bendahara.'
      };
    }

    const res = await sendOtpWithWabaSettings({ settings, phone, code });
    return {
      success: res.success,
      message: res.message
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Gagal mengirim kode verifikasi WhatsApp WABA Official.'
    };
  }
}
