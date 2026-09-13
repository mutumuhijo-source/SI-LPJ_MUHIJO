// Utility functions for formatting, currency, terbilang, and sandboxed dialogs

export const parseAmount = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str) return 0;

  // Indonesian format with thousand dots and decimal comma e.g. "1.250.000,50"
  if (str.includes('.') && str.includes(',')) {
    const normalized = str.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  }

  // Indonesian format with comma only as decimal e.g. "1250000,50"
  if (str.includes(',') && !str.includes('.')) {
    const normalized = str.replace(',', '.');
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  }

  // Multiple thousand separator dots without decimal e.g. "1.250.000"
  const dotCount = (str.match(/\./g) || []).length;
  if (dotCount > 1) {
    const normalized = str.replace(/\./g, '');
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  }

  // Standard float representation e.g. "1250000.50" or "1250000"
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
};

export const formatDate = (
  dateValue: string | number | Date | undefined | null,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'long' }
): string => {
  if (!dateValue) return '-';
  try {
    const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(d.getTime())) return String(dateValue);
    return d.toLocaleDateString('id-ID', options);
  } catch (e) {
    return String(dateValue);
  }
};

export const formatCurrency = (amount: number | string | undefined | null): string => {
  if (amount === undefined || amount === null || amount === '') return '0';
  try {
    const val = typeof amount === 'number' ? amount : parseAmount(amount);
    if (isNaN(val)) return '0';
    const isInt = Number.isInteger(val);
    return val.toLocaleString('id-ID', {
      minimumFractionDigits: isInt ? 0 : 2,
      maximumFractionDigits: 4,
    });
  } catch (e) {
    return String(amount || 0);
  }
};

export const terbilang = (n: number | string): string => {
  const num = typeof n === 'number' ? n : parseAmount(n);
  if (isNaN(num) || num === 0) return 'Nol Rupiah';
  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  
  function convert(val: number): string {
    if (val < 12) return satuan[val];
    if (val < 20) return convert(val - 10) + ' Belas';
    if (val < 100) return satuan[Math.floor(val / 10)] + ' Puluh ' + convert(val % 10);
    if (val < 200) return 'Seratus ' + convert(val - 100);
    if (val < 1000) return satuan[Math.floor(val / 100)] + ' Ratus ' + convert(val % 100);
    if (val < 2000) return 'Seribu ' + convert(val - 1000);
    if (val < 1000000) return convert(Math.floor(val / 1000)) + ' Ribu ' + convert(val % 1000);
    if (val < 1000000000) return convert(Math.floor(val / 1000000)) + ' Juta ' + convert(val % 1000000);
    if (val < 1000000000000) return convert(Math.floor(val / 1000000000)) + ' Miliar ' + convert(val % 1000000000);
    return convert(Math.floor(val / 1000000000000)) + ' Triliun ' + convert(val % 1000000000000);
  }

  const absVal = Math.abs(num);
  const intPart = Math.floor(absVal);
  const decPart = Math.round((absVal - intPart) * 100);

  let result = '';
  if (intPart > 0) {
    result = convert(intPart).replace(/\s+/g, ' ').trim() + ' Rupiah';
  }
  if (decPart > 0) {
    const decText = convert(decPart).replace(/\s+/g, ' ').trim() + ' Sen';
    result = result ? `${result} ${decText}` : `${decText}`;
  }

  return result || 'Nol Rupiah';
};

export const safeAlert = (message: string) => {
  try {
    window.alert(message);
  } catch (e) {
    console.warn("window.alert blocked or failed inside iframe sandbox:", e);
  }
};

export const safeConfirm = (message: string): boolean => {
  try {
    return window.confirm(message);
  } catch (e) {
    console.warn("window.confirm blocked or failed inside iframe sandbox:", e);
    return true;
  }
};
