import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  Pencil, 
  Printer, 
  ArrowLeft, 
  Search, 
  CheckCircle2, 
  Calendar, 
  DollarSign, 
  Calculator, 
  UserCheck, 
  Building2, 
  Coins, 
  FileText,
  AlertCircle,
  RotateCw,
  Eye
} from 'lucide-react';
import { SchoolSettings, CashMemorial, CashDenomination, OperationType, Report, ReportStatus, DirectCashOutflow } from '../types';
import { Firestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { safeAlert, safeConfirm, formatCurrency } from '../lib/utils';
import { handleFirestoreError } from '../lib/error-handler';

interface MemorialKasTunaiPageProps {
  db: Firestore;
  schoolSettings: SchoolSettings;
  reports?: Report[];
  userEmail: string;
}

const DEFAULT_PAPER_DENOMINATIONS: number[] = [100000, 50000, 20000, 10000, 5000, 2000, 1000];
const DEFAULT_COIN_DENOMINATIONS: number[] = [1000, 500, 200, 100];

const INDONESIAN_MONTH_NAMES = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
];

export const MemorialKasTunaiPage: React.FC<MemorialKasTunaiPageProps> = ({
  db,
  schoolSettings,
  reports = [],
  userEmail,
}) => {
  const [memorials, setMemorials] = useState<CashMemorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'create' | 'edit' | 'print'>('list');
  const [activeMemorial, setActiveMemorial] = useState<CashMemorial | null>(null);
  const [printDocType, setPrintDocType] = useState<'all' | 'persetujuan' | 'berita_acara'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Default month and year filter set to current month & year
  const currentNow = new Date();
  const defaultCurrentMonth = INDONESIAN_MONTH_NAMES[currentNow.getMonth()];
  const defaultCurrentYear = String(currentNow.getFullYear());

  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>(defaultCurrentMonth);
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>(defaultCurrentYear);

  // Form states
  const [month, setMonth] = useState<string>(defaultCurrentMonth);
  const [year, setYear] = useState<string>(defaultCurrentYear);
  const [date, setDate] = useState<string>('');
  const [city, setCity] = useState<string>(schoolSettings.memoCity || 'Ngadirejo');

  // Balances
  const [initialBalance, setInitialBalance] = useState<number>(5000000);
  const [totalExpense, setTotalExpense] = useState<number>(2000000);
  const [remainingBalance, setRemainingBalance] = useState<number>(3000000);
  const [replenishmentAmount, setReplenishmentAmount] = useState<number>(2000000);

  // Cash Opname Count Data
  const [countDate, setCountDate] = useState<string>('');
  const [paperNotes, setPaperNotes] = useState<CashDenomination[]>(() => 
    DEFAULT_PAPER_DENOMINATIONS.map(nominal => ({
      nominal,
      type: 'kertas',
      quantity: 0,
      subtotal: 0
    }))
  );
  const [coins, setCoins] = useState<CashDenomination[]>(() => 
    DEFAULT_COIN_DENOMINATIONS.map(nominal => ({
      nominal,
      type: 'logam',
      quantity: 0,
      subtotal: 0
    }))
  );
  const [differenceNote, setDifferenceNote] = useState<string>('');

  // Signatories
  const [approverDate, setApproverDate] = useState<string>('............');
  const [approverName, setApproverName] = useState<string>(schoolSettings.principalName || 'Ikhsan Nuriyanto, S.Pd');
  const [approverNbm, setApproverNbm] = useState<string>(schoolSettings.principalNbm || '853 837');

  const [checkerName, setCheckerName] = useState<string>(schoolSettings.memoCheckerName || 'Beny Setiawan, S.Pd.');
  const [checkerNbm, setCheckerNbm] = useState<string>(schoolSettings.memoCheckerNbm || '1239 946');

  const [makerName, setMakerName] = useState<string>(schoolSettings.treasurerName || 'Desfiana Giant Pratiwi, S.AP');
  const [makerNbm, setMakerNbm] = useState<string>(schoolSettings.treasurerNbm || '1382 596');

  const printContainerRef = useRef<HTMLDivElement>(null);

  // Fetch Memorial Kas Tunai from Firestore
  useEffect(() => {
    setLoading(true);
    const q = collection(db, 'cash_memorials');
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CashMemorial[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as CashMemorial);
        });
        // Sort newest first
        list.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return timeB - timeA;
        });
        setMemorials(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching cash memorials:', error);
        handleFirestoreError(error, OperationType.LIST, 'cash_memorials');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db]);

  // Sync initial signers when school settings update
  useEffect(() => {
    if (mode === 'create') {
      if (schoolSettings.memoCity) setCity(schoolSettings.memoCity);
      if (schoolSettings.principalName) setApproverName(schoolSettings.principalName);
      if (schoolSettings.principalNbm) setApproverNbm(schoolSettings.principalNbm);
      if (schoolSettings.memoCheckerName) setCheckerName(schoolSettings.memoCheckerName);
      if (schoolSettings.memoCheckerNbm) setCheckerNbm(schoolSettings.memoCheckerNbm);
      if (schoolSettings.treasurerName) setMakerName(schoolSettings.treasurerName);
      if (schoolSettings.treasurerNbm) setMakerNbm(schoolSettings.treasurerNbm);
    }
  }, [schoolSettings, mode]);

  // Format currency helper
  const formatRupiah = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return val.toLocaleString('id-ID');
  };

  // Helper normalize month name
  const normalizeMonthName = (mStr?: string): string => {
    if (!mStr) return '';
    const clean = mStr.trim().toUpperCase();
    const monthMap: Record<string, string> = {
      '1': 'JANUARI', '01': 'JANUARI', 'JANUARI': 'JANUARI', 'JAN': 'JANUARI',
      '2': 'FEBRUARI', '02': 'FEBRUARI', 'FEBRUARI': 'FEBRUARI', 'FEB': 'FEBRUARI',
      '3': 'MARET', '03': 'MARET', 'MARET': 'MARET', 'MAR': 'MARET',
      '4': 'APRIL', '04': 'APRIL', 'APRIL': 'APRIL', 'APR': 'APRIL',
      '5': 'MEI', '05': 'MEI', 'MEI': 'MEI',
      '6': 'JUNI', '06': 'JUNI', 'JUNI': 'JUNI', 'JUN': 'JUNI',
      '7': 'JULI', '07': 'JULI', 'JULI': 'JULI', 'JUL': 'JULI',
      '8': 'AGUSTUS', '08': 'AGUSTUS', 'AGUSTUS': 'AGUSTUS', 'AGU': 'AGUSTUS', 'AGT': 'AGUSTUS',
      '9': 'SEPTEMBER', '09': 'SEPTEMBER', 'SEPTEMBER': 'SEPTEMBER', 'SEP': 'SEPTEMBER',
      '10': 'OKTOBER', 'OKTOBER': 'OKTOBER', 'OKT': 'OKTOBER',
      '11': 'NOVEMBER', 'NOVEMBER': 'NOVEMBER', 'NOV': 'NOVEMBER',
      '12': 'DESEMBER', 'DESEMBER': 'DESEMBER', 'DES': 'DESEMBER'
    };
    return monthMap[clean] || clean;
  };

  // Calculate totals for physical cash count
  const calculatedTotalPaper = useMemo(() => {
    return paperNotes.reduce((acc, curr) => acc + (curr.quantity * curr.nominal), 0);
  }, [paperNotes]);

  const calculatedTotalCoin = useMemo(() => {
    return coins.reduce((acc, curr) => acc + (curr.quantity * curr.nominal), 0);
  }, [coins]);

  const calculatedTotalPhysicalCash = useMemo(() => {
    return calculatedTotalPaper + calculatedTotalCoin;
  }, [calculatedTotalPaper, calculatedTotalCoin]);

  // Recalculate remaining balance & replenishment amount automatically when initial or expense changes
  const handleInitialBalanceChange = (val: number) => {
    setInitialBalance(val);
    const rem = val - totalExpense;
    setRemainingBalance(rem);
  };

  const handleTotalExpenseChange = (val: number) => {
    setTotalExpense(val);
    const rem = initialBalance - val;
    setRemainingBalance(rem);
    setReplenishmentAmount(val); // By standard imprest fund system, replenishment equals expense
  };

  // Update paper note count
  const handlePaperQuantityChange = (nominal: number, qty: number) => {
    const validQty = Math.max(0, isNaN(qty) ? 0 : qty);
    setPaperNotes(prev => prev.map(p => {
      if (p.nominal === nominal) {
        return {
          ...p,
          quantity: validQty,
          subtotal: validQty * nominal
        };
      }
      return p;
    }));
  };

  // Update coin count
  const handleCoinQuantityChange = (nominal: number, qty: number) => {
    const validQty = Math.max(0, isNaN(qty) ? 0 : qty);
    setCoins(prev => prev.map(c => {
      if (c.nominal === nominal) {
        return {
          ...c,
          quantity: validQty,
          subtotal: validQty * nominal
        };
      }
      return c;
    }));
  };

  // Auto-fill physical cash denominations to exactly match the remaining balance
  const handleAutoFillPhysicalCash = () => {
    let target = remainingBalance;
    if (target <= 0) {
      safeAlert('Sisa saldo kas bernilai 0 atau negatif, tidak ada pecahan fisik yang dialokasikan.');
      return;
    }

    const newPaper = DEFAULT_PAPER_DENOMINATIONS.map(nominal => {
      const count = Math.floor(target / nominal);
      target -= count * nominal;
      return {
        nominal,
        type: 'kertas' as const,
        quantity: count,
        subtotal: count * nominal
      };
    });

    const newCoins = DEFAULT_COIN_DENOMINATIONS.map(nominal => {
      const count = Math.floor(target / nominal);
      target -= count * nominal;
      return {
        nominal,
        type: 'logam' as const,
        quantity: count,
        subtotal: count * nominal
      };
    });

    setPaperNotes(newPaper);
    setCoins(newCoins);
    safeAlert('Pecahan fisik uang kas berhasil disesuaikan dengan Sisa Saldo Kas Tunai!');
  };

  // Calculate actual total expense from BKK / Reports in this month
  const handleAutoCalculateExpenseFromBKK = async () => {
    try {
      const targetMonthIndex = INDONESIAN_MONTH_NAMES.indexOf(normalizeMonthName(month));
      const targetYearNum = parseInt(year, 10);
      
      let calculatedExpense = 0;

      // 1. Direct Outflows in this month
      const outflowsSnap = await getDocs(collection(db, 'direct_cash_outflows'));
      outflowsSnap.forEach(docSnap => {
        const data = docSnap.data() as DirectCashOutflow;
        if (data.date) {
          const d = new Date(data.date);
          if (!isNaN(d.getTime())) {
            if (d.getMonth() === targetMonthIndex && d.getFullYear() === targetYearNum) {
              calculatedExpense += Number(data.amount || 0);
            }
          }
        }
      });

      // 2. Completed / Reporting reports with dates in this month
      reports.forEach(r => {
        if (r.status === ReportStatus.COMPLETED || r.status === ReportStatus.REPORTING) {
          const repDateStr = r.completedDate || r.reportingInstructedDate || r.approvalDate || r.submissionDate;
          if (repDateStr) {
            const d = new Date(repDateStr);
            if (!isNaN(d.getTime())) {
              if (d.getMonth() === targetMonthIndex && d.getFullYear() === targetYearNum) {
                calculatedExpense += Number(r.totalSpent || r.amountReceived || 0);
              }
            }
          }
        }
      });

      if (calculatedExpense > 0) {
        handleTotalExpenseChange(calculatedExpense);
        safeAlert(`Total Pengeluaran Kas Tunai bulan ${month} ${year} terhitung: Rp ${formatRupiah(calculatedExpense)}`);
      } else {
        safeAlert(`Tidak ditemukan data pengeluaran kas tercatat di Buku Kas pada bulan ${month} ${year}. Anda dapat mengisi manual.`);
      }
    } catch (e) {
      console.error("Failed to calculate expense from BKK:", e);
      safeAlert("Gagal menghitung otomatis dari Buku Kas. Silakan masukkan nilai pengeluaran secara manual.");
    }
  };

  // Open Create Form
  const handleOpenCreate = () => {
    const now = new Date();
    const curMonth = INDONESIAN_MONTH_NAMES[now.getMonth()];
    const curYear = String(now.getFullYear());
    const day = now.getDate();
    const formattedDate = `${day} ${curMonth.charAt(0) + curMonth.slice(1).toLowerCase()} ${curYear}`;

    setMonth(curMonth);
    setYear(curYear);
    setDate(formattedDate);
    setCountDate(formattedDate);
    setCity(schoolSettings.memoCity || 'Ngadirejo');

    setInitialBalance(5000000);
    setTotalExpense(2000000);
    setRemainingBalance(3000000);
    setReplenishmentAmount(2000000);

    setPaperNotes(DEFAULT_PAPER_DENOMINATIONS.map(nominal => {
      let qty = 0;
      if (nominal === 100000) qty = 3;
      else if (nominal === 50000) qty = 7;
      else if (nominal === 20000) qty = 1;
      else if (nominal === 10000) qty = 10;
      else if (nominal === 5000) qty = 26;
      return {
        nominal,
        type: 'kertas',
        quantity: qty,
        subtotal: qty * nominal
      };
    }));

    setCoins(DEFAULT_COIN_DENOMINATIONS.map(nominal => ({
      nominal,
      type: 'logam',
      quantity: 0,
      subtotal: 0
    })));

    setDifferenceNote('');

    setApproverDate('............');
    setApproverName(schoolSettings.principalName || 'Ikhsan Nuriyanto, S.Pd');
    setApproverNbm(schoolSettings.principalNbm || '853 837');

    setCheckerName(schoolSettings.memoCheckerName || 'Beny Setiawan, S.Pd.');
    setCheckerNbm(schoolSettings.memoCheckerNbm || '1239 946');

    setMakerName(schoolSettings.treasurerName || 'Desfiana Giant Pratiwi, S.AP');
    setMakerNbm(schoolSettings.treasurerNbm || '1382 596');

    setActiveMemorial(null);
    setMode('create');
  };

  // Open Edit Form
  const handleOpenEdit = (memo: CashMemorial) => {
    setActiveMemorial(memo);
    setMonth(memo.month);
    setYear(memo.year);
    setDate(memo.date || '');
    setCountDate(memo.countDate || memo.date || '');
    setCity(memo.city || schoolSettings.memoCity || 'Ngadirejo');

    setInitialBalance(memo.initialBalance);
    setTotalExpense(memo.totalExpense);
    setRemainingBalance(memo.remainingBalance);
    setReplenishmentAmount(memo.replenishmentAmount);

    // Populate paper notes
    if (memo.paperNotes && memo.paperNotes.length > 0) {
      setPaperNotes(memo.paperNotes);
    } else {
      setPaperNotes(DEFAULT_PAPER_DENOMINATIONS.map(nominal => ({
        nominal,
        type: 'kertas',
        quantity: 0,
        subtotal: 0
      })));
    }

    // Populate coins
    if (memo.coins && memo.coins.length > 0) {
      setCoins(memo.coins);
    } else {
      setCoins(DEFAULT_COIN_DENOMINATIONS.map(nominal => ({
        nominal,
        type: 'logam',
        quantity: 0,
        subtotal: 0
      })));
    }

    setDifferenceNote(memo.differenceNote || '');

    setApproverDate(memo.approverDate || '............');
    setApproverName(memo.approverName || schoolSettings.principalName || '');
    setApproverNbm(memo.approverNbm || schoolSettings.principalNbm || '');

    setCheckerName(memo.checkerName || schoolSettings.memoCheckerName || '');
    setCheckerNbm(memo.checkerNbm || schoolSettings.memoCheckerNbm || '');

    setMakerName(memo.makerName || schoolSettings.treasurerName || '');
    setMakerNbm(memo.makerNbm || schoolSettings.treasurerNbm || '');

    setMode('edit');
  };

  // Open Print Mode
  const handleOpenPrint = (memo: CashMemorial, docType: 'all' | 'persetujuan' | 'berita_acara' = 'all') => {
    setActiveMemorial(memo);
    setPrintDocType(docType);
    setMode('print');
  };

  // Save Memorial Record to Firestore
  const handleSaveMemorial = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Partial<CashMemorial> = {
      month: normalizeMonthName(month),
      year: year.trim(),
      date: date.trim(),
      city: city.trim(),
      
      initialBalance: Number(initialBalance) || 0,
      totalExpense: Number(totalExpense) || 0,
      remainingBalance: Number(remainingBalance) || 0,
      replenishmentAmount: Number(replenishmentAmount) || 0,

      countDate: countDate.trim() || date.trim(),
      paperNotes: paperNotes.map(p => ({
        nominal: p.nominal,
        type: 'kertas',
        quantity: Number(p.quantity) || 0,
        subtotal: (Number(p.quantity) || 0) * p.nominal
      })),
      coins: coins.map(c => ({
        nominal: c.nominal,
        type: 'logam',
        quantity: Number(c.quantity) || 0,
        subtotal: (Number(c.quantity) || 0) * c.nominal
      })),
      totalPaperAmount: calculatedTotalPaper,
      totalCoinAmount: calculatedTotalCoin,
      totalPhysicalCash: calculatedTotalPhysicalCash,
      differenceNote: differenceNote.trim(),

      approverDate: approverDate.trim(),
      approverName: approverName.trim(),
      approverNbm: approverNbm.trim(),

      checkerName: checkerName.trim(),
      checkerNbm: checkerNbm.trim(),

      makerName: makerName.trim(),
      makerNbm: makerNbm.trim(),

      updatedAt: serverTimestamp()
    };

    try {
      if (mode === 'create') {
        payload.createdAt = serverTimestamp();
        payload.createdBy = userEmail;
        payload.isPosted = false;
        await addDoc(collection(db, 'cash_memorials'), payload);
        safeAlert('Memorial Kas Tunai berhasil disimpan!');
      } else if (mode === 'edit' && activeMemorial?.id) {
        await updateDoc(doc(db, 'cash_memorials', activeMemorial.id), payload);
        safeAlert('Perubahan Memorial Kas Tunai berhasil disimpan!');
      }
      setMode('list');
      setActiveMemorial(null);
    } catch (err) {
      console.error('Error saving memorial:', err);
      handleFirestoreError(err, mode === 'create' ? OperationType.CREATE : OperationType.UPDATE, 'cash_memorials');
    }
  };

  // Convert Memorial date text to ISO YYYY-MM-DD
  const convertMemorialDateToIso = (dateStr?: string, yearStr?: string, monthStr?: string): string => {
    if (!dateStr) {
      const y = yearStr && /^\d{4}$/.test(yearStr.trim()) ? yearStr.trim() : '2026';
      const mIdx = monthStr ? INDONESIAN_MONTH_NAMES.indexOf(normalizeMonthName(monthStr)) : -1;
      const m = mIdx >= 0 ? String(mIdx + 1).padStart(2, '0') : '01';
      return `${y}-${m}-01`;
    }
    const clean = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      return clean;
    }
    const parts = clean.split(/\s+/);
    if (parts.length >= 3) {
      const day = parseInt(parts[0], 10);
      const mName = normalizeMonthName(parts[1]);
      const mIdx = INDONESIAN_MONTH_NAMES.indexOf(mName);
      const y = parseInt(parts[2], 10);
      if (!isNaN(day) && mIdx >= 0 && !isNaN(y)) {
        return `${y}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    const fallbackYear = yearStr && /^\d{4}$/.test(yearStr.trim()) ? yearStr.trim() : '2026';
    const fallbackMonthIdx = monthStr ? INDONESIAN_MONTH_NAMES.indexOf(normalizeMonthName(monthStr)) : -1;
    const fallbackMonth = fallbackMonthIdx >= 0 ? String(fallbackMonthIdx + 1).padStart(2, '0') : '01';
    return `${fallbackYear}-${fallbackMonth}-01`;
  };

  // Posting Memorial Kas Tunai ke Buku Kas sebagai Pengeluaran Kas Tunai (Pengisian Kembali Kas)
  const handlePostToBukuKas = async (memo: CashMemorial) => {
    if (!memo.id) return;
    if (memo.isPosted) {
      safeAlert('Dokumen Memorial Kas Tunai ini sudah diposting ke Buku Kas.');
      return;
    }

    const confirmMsg = `Posting Memorial Kas Tunai (Bulan ${memo.month} ${memo.year}) sebesar Rp ${formatRupiah(memo.replenishmentAmount)} ke Buku Kas sebagai Pengeluaran Kas untuk Pengisian Kembali Kas Tunai?`;
    if (!safeConfirm(confirmMsg)) return;

    const normMonth = normalizeMonthName(memo.month);
    const yearStr = memo.year ? memo.year.trim() : String(new Date().getFullYear());
    const formattedDate = convertMemorialDateToIso(memo.date || memo.countDate, yearStr, normMonth);
    const generatedNoBukti = `BKK/MKT-${normMonth.slice(0, 3)}-${yearStr}`;

    const outflowPayload = {
      date: formattedDate,
      noBukti: generatedNoBukti,
      unitName: 'Operasional Kas Sekolah',
      category: 'Pengisian Kas Tunai',
      description: `Pengisian Kembali Kas Tunai Bulan ${normMonth} ${yearStr}`,
      amount: Number(memo.replenishmentAmount) || 0,
      employeeName: memo.makerName || schoolSettings.treasurerName || 'Bendahara Kas Tunai',
      notes: `Otomatis diposting dari Memorial Kas Tunai (Bulan ${normMonth} ${yearStr}) - Plafon: Rp ${formatRupiah(memo.initialBalance)}, Pengeluaran: Rp ${formatRupiah(memo.totalExpense)}, Sisa: Rp ${formatRupiah(memo.remainingBalance)}`,
      createdAt: serverTimestamp(),
      createdBy: userEmail
    };

    try {
      const docRef = await addDoc(collection(db, 'direct_cash_outflows'), outflowPayload);

      await updateDoc(doc(db, 'cash_memorials', memo.id), {
        isPosted: true,
        postedAt: serverTimestamp(),
        postedBy: userEmail,
        cashOutflowId: docRef.id,
        updatedAt: serverTimestamp()
      });

      if (activeMemorial && activeMemorial.id === memo.id) {
        setActiveMemorial({
          ...activeMemorial,
          isPosted: true,
          cashOutflowId: docRef.id
        });
      }

      safeAlert(`Berhasil memposting Memorial Kas Tunai ke Buku Kas!\nPengeluaran Kas Tunai untuk Pengisian Kembali sebesar Rp ${formatRupiah(memo.replenishmentAmount)} telah dicatat di Buku Kas Keluar.`);
    } catch (err) {
      console.error('Error posting memorial to Buku Kas:', err);
      handleFirestoreError(err, OperationType.CREATE, 'direct_cash_outflows');
    }
  };

  // Batalkan Posting Memorial Kas Tunai dari Buku Kas
  const handleUnpostFromBukuKas = async (memo: CashMemorial) => {
    if (!memo.id) return;
    if (!memo.isPosted) return;

    if (!safeConfirm(`Batalkan posting Memorial Kas Tunai (Bulan ${memo.month} ${memo.year})? Catatan pengeluaran pengisian kembali di Buku Kas akan dihapus.`)) return;

    try {
      if (memo.cashOutflowId) {
        try {
          await deleteDoc(doc(db, 'direct_cash_outflows', memo.cashOutflowId));
        } catch (delErr) {
          console.warn('Direct outflow document already removed:', delErr);
        }
      }

      await updateDoc(doc(db, 'cash_memorials', memo.id), {
        isPosted: false,
        postedAt: null,
        postedBy: null,
        cashOutflowId: null,
        updatedAt: serverTimestamp()
      });

      if (activeMemorial && activeMemorial.id === memo.id) {
        setActiveMemorial({
          ...activeMemorial,
          isPosted: false,
          cashOutflowId: undefined
        });
      }

      safeAlert('Posting Memorial Kas Tunai berhasil dibatalkan. Catatan pengeluaran pengisian kembali di Buku Kas telah dihapus.');
    } catch (err) {
      console.error('Error unposting memorial from Buku Kas:', err);
      handleFirestoreError(err, OperationType.DELETE, `direct_cash_outflows/${memo.cashOutflowId}`);
    }
  };

  // Delete Memorial Record
  const handleDeleteMemorial = async (id: string, label: string, cashOutflowId?: string) => {
    if (!safeConfirm(`Hapus dokumen Memorial Kas Tunai "${label}"? Tindakan ini tidak dapat dibatalkan.`)) return;

    try {
      if (cashOutflowId) {
        try {
          await deleteDoc(doc(db, 'direct_cash_outflows', cashOutflowId));
        } catch (delErr) {
          console.warn('Direct outflow document already removed:', delErr);
        }
      }
      await deleteDoc(doc(db, 'cash_memorials', id));
      safeAlert('Dokumen Memorial Kas Tunai berhasil dihapus.');
      if (activeMemorial?.id === id) {
        setActiveMemorial(null);
        setMode('list');
      }
    } catch (err) {
      console.error('Error deleting memorial:', err);
      handleFirestoreError(err, OperationType.DELETE, `cash_memorials/${id}`);
    }
  };

  // Direct print action
  const handlePrint = () => {
    window.print();
  };

  // Available year options
  const availableYearOptions = useMemo(() => {
    const yearsSet = new Set<string>();
    const currentY = String(new Date().getFullYear());
    yearsSet.add(currentY);
    yearsSet.add('2026');
    yearsSet.add('2025');

    memorials.forEach(m => {
      if (m.year && /^\d{4}$/.test(m.year.trim())) {
        yearsSet.add(m.year.trim());
      }
    });

    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [memorials]);

  // Filtered memorials list
  const filteredMemorials = useMemo(() => {
    return memorials.filter(m => {
      const matchesSearch = !searchTerm || (
        m.month.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.year.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.date && m.date.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      const normMonth = normalizeMonthName(m.month);
      const matchesMonth = selectedMonthFilter === 'ALL' || normMonth === selectedMonthFilter;

      const memoYearStr = (m.year || '').trim();
      const matchesYear = selectedYearFilter === 'ALL' || memoYearStr === selectedYearFilter;

      return matchesSearch && matchesMonth && matchesYear;
    });
  }, [memorials, searchTerm, selectedMonthFilter, selectedYearFilter]);

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------- */}
      {/* MODE 1: PRINT / PDF PREVIEW VIEW                              */}
      {/* ------------------------------------------------------------- */}
      {mode === 'print' && activeMemorial && (
        <div className="memorial-print-wrapper fixed inset-0 bg-white z-50 overflow-y-auto p-4 sm:p-10 print:p-0 print:static print:bg-white">
          {/* Top Bar for Actions in Preview Mode */}
          <div className="max-w-[210mm] mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4 print:hidden" data-print-hide="true">
            <button
              onClick={() => setMode('list')}
              className="px-5 py-2.5 bg-natural-bg border border-natural-border text-natural-primary rounded-full text-xs font-bold flex items-center gap-2 hover:bg-natural-border/50 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Daftar Memorial
            </button>

            {/* Document Selector */}
            <div className="flex items-center gap-1.5 bg-natural-bg p-1 rounded-full border border-natural-border text-xs">
              <button
                onClick={() => setPrintDocType('all')}
                className={`px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer ${printDocType === 'all' ? 'bg-natural-primary text-white shadow-xs' : 'text-natural-secondary hover:text-natural-primary'}`}
              >
                Cetak Semua (2 Halaman A4)
              </button>
              <button
                onClick={() => setPrintDocType('persetujuan')}
                className={`px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer ${printDocType === 'persetujuan' ? 'bg-natural-primary text-white shadow-xs' : 'text-natural-secondary hover:text-natural-primary'}`}
              >
                1. Persetujuan Pengisian Kas
              </button>
              <button
                onClick={() => setPrintDocType('berita_acara')}
                className={`px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer ${printDocType === 'berita_acara' ? 'bg-natural-primary text-white shadow-xs' : 'text-natural-secondary hover:text-natural-primary'}`}
              >
                2. Berita Acara Kas Opname
              </button>
            </div>

            <div className="flex items-center gap-2">
              {activeMemorial.isPosted ? (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-full text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    Terposting ke Buku Kas
                  </span>
                  <button
                    onClick={() => handleUnpostFromBukuKas(activeMemorial)}
                    className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    title="Batalkan posting ke Buku Kas"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Batal Posting
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handlePostToBukuKas(activeMemorial)}
                  className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  title="Posting ke Buku Kas sebagai Pengeluaran Pengisian Kas Tunai"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Posting ke Buku Kas
                </button>
              )}

              <button
                onClick={() => handleOpenEdit(activeMemorial)}
                className="px-4 py-2.5 bg-amber-600 text-white rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-amber-700 transition-all shadow-md cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Data
              </button>

              <button
                onClick={handlePrint}
                className="px-6 py-2.5 bg-emerald-700 text-white rounded-full text-xs font-bold flex items-center gap-2 hover:bg-emerald-800 transition-all shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Cetak / Simpan PDF (A4)
              </button>
            </div>
          </div>

          {/* DOCUMENT PRINT CONTAINER (A4 FORMAT) */}
          <div 
            id="memorial-kas-print-area"
            ref={printContainerRef}
            className="max-w-[210mm] mx-auto space-y-12 print:space-y-0"
          >
            {/* ========================================================= */}
            {/* DOKUMEN 1: PERSETUJUAN PENGISIAN KEMBALI KAS TUNAI        */}
            {/* ========================================================= */}
            {(printDocType === 'all' || printDocType === 'persetujuan') && (
              <div 
                className="printable-a4-page bg-white p-[15mm] print:p-0 print:m-0 border border-gray-300 shadow-xl print:shadow-none print:border-none font-sans text-black leading-normal select-text"
                style={{ minHeight: '297mm' }}
              >
                {/* Kop Surat Header from School Settings */}
                {(schoolSettings.kopHeaderUrl || schoolSettings.memoHeaderUrl) ? (
                  <div className="mb-6 pb-2 border-b-2 border-black text-center">
                    <img 
                      src={schoolSettings.kopHeaderUrl || schoolSettings.memoHeaderUrl} 
                      alt="Kop Surat Sekolah" 
                      className="w-full max-h-36 object-contain mx-auto"
                    />
                  </div>
                ) : (
                  <div className="mb-6 pb-3 border-b-2 border-black text-center">
                    <div className="font-bold text-xs uppercase tracking-wide">MAJELIS PENDIDIKAN DASAR DAN MENENGAH</div>
                    <div className="font-bold text-xs uppercase tracking-wide">PIMPINAN DAERAH MUHAMMADIYAH KABUPATEN TEMANGGUNG</div>
                    <div className="font-bold text-xl uppercase tracking-wider my-0.5">SMK MUHAMMADIYAH 1 NGADIREJO</div>
                    <div className="text-[10px] uppercase">KOMPETENSI KEAHLIAN : TEKNIK AUDIO VIDEO, AKUNTANSI DAN KEUANGAN LEMBAGA, TATA BUSANA, TEKNIK DAN BISNIS SEPEDA MOTOR</div>
                    <div className="text-[10px] text-gray-700 mt-1">Alamat : Jl. Raya Candiroto, Ngaren, Ngadirejo - Temanggung, Kode Pos 56255</div>
                    <div className="text-[10px] text-gray-700">Telp : (0293) 5916044, 591159 email : smkngadirejo@yahoo.com, website : www.smkmuhngadirejo.sch.id</div>
                  </div>
                )}

                {/* Judul Dokumen */}
                <div className="text-center font-bold text-base mb-6 tracking-wide uppercase mt-4">
                  <div className="underline">PERSETUJUAN PENGISIAN KEMBALI KAS TUNAI</div>
                  <div>BULAN {activeMemorial.month} {activeMemorial.year}</div>
                </div>

                {/* Paragraf Pembuka */}
                <p className="text-xs text-justify mb-6 leading-relaxed font-normal">
                  Sehubungan dengan saldo kas tunai yang telah menipis untuk pembiayaan operasional harian, bersama ini kami mengajukan pengisian kembali kas tunai dengan rincian sebagai berikut:
                </p>

                {/* Tabel Rincian Pengisian Kas Tunai */}
                <table className="w-full text-xs border-2 border-black border-collapse mb-8">
                  <thead>
                    <tr className="border-b-2 border-black bg-gray-50/50">
                      <th className="p-2.5 border-r-2 border-black text-center font-bold uppercase w-1/2">
                        Keterangan
                      </th>
                      <th className="p-2.5 text-center font-bold uppercase w-1/2">
                        Jumlah
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="p-2.5 border-r-2 border-black font-normal">
                        Saldo Awal
                      </td>
                      <td className="p-2.5 text-right font-mono font-normal whitespace-nowrap">
                        Rp {formatRupiah(activeMemorial.initialBalance)},-
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-2.5 border-r-2 border-black font-normal">
                        Total Pengeluaran
                      </td>
                      <td className="p-2.5 text-right font-mono font-normal whitespace-nowrap">
                        Rp {formatRupiah(activeMemorial.totalExpense)},-
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-2.5 border-r-2 border-black font-normal">
                        Sisa Saldo Kas Tunai
                      </td>
                      <td className="p-2.5 text-right font-mono font-normal whitespace-nowrap">
                        Rp {formatRupiah(activeMemorial.remainingBalance)},-
                      </td>
                    </tr>
                    <tr className="font-bold bg-gray-50/30">
                      <td className="p-2.5 border-r-2 border-black uppercase">
                        Jumlah Pengisian Kembali
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold whitespace-nowrap">
                        Rp {formatRupiah(activeMemorial.replenishmentAmount)},-
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Paragraf Penutup */}
                <p className="text-xs mb-12 leading-relaxed font-normal">
                  Demikian persetujuan ini kami buat, atas perhatiannya diucapkan terima kasih.
                </p>

                {/* Kolom Tanda Tangan (3 Kolom) */}
                <div className="grid grid-cols-3 gap-4 text-xs text-center font-normal mt-16">
                  {/* Kolom 1: Disetujui Oleh (Kepala Sekolah) */}
                  <div className="flex flex-col items-center justify-between h-36">
                    <div className="space-y-1">
                      <div>Disetujui Tanggal : {activeMemorial.approverDate || '............'}</div>
                      <div>Disetujui oleh,</div>
                    </div>
                    <div className="space-y-0.5 font-bold">
                      <div>{activeMemorial.approverName || '.......................'}</div>
                      {activeMemorial.approverNbm && (
                        <div className="font-normal font-mono text-[11px]">
                          NBM. {activeMemorial.approverNbm}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Kolom 2: Diperiksa Oleh */}
                  <div className="flex flex-col items-center justify-between h-36">
                    <div className="space-y-1">
                      <div className="opacity-0">.</div>
                      <div>Diperiksa Oleh,</div>
                    </div>
                    <div className="space-y-0.5 font-bold">
                      <div>{activeMemorial.checkerName || '.......................'}</div>
                      {activeMemorial.checkerNbm && (
                        <div className="font-normal font-mono text-[11px]">
                          NBM. {activeMemorial.checkerNbm}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Kolom 3: Dibuat Oleh (Bendahara Kas Tunai) */}
                  <div className="flex flex-col items-center justify-between h-36">
                    <div className="space-y-1">
                      <div>{activeMemorial.city || 'Ngadirejo'}, {activeMemorial.date || '...................'}</div>
                      <div>Dibuat Oleh</div>
                    </div>
                    <div className="space-y-0.5 font-bold">
                      <div>{activeMemorial.makerName || '.......................'}</div>
                      {activeMemorial.makerNbm && (
                        <div className="font-normal font-mono text-[11px]">
                          NBM. {activeMemorial.makerNbm}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* DOKUMEN 2: BERITA ACARA PERHITUNGAN UANG KAS (KAS OPNAME) */}
            {/* ========================================================= */}
            {(printDocType === 'all' || printDocType === 'berita_acara') && (
              <div 
                className={`printable-a4-page bg-white p-[15mm] print:p-0 print:m-0 border border-gray-300 shadow-xl print:shadow-none print:border-none font-sans text-black leading-normal select-text ${printDocType === 'all' ? 'print-page-break mt-12 print:mt-0' : ''}`}
                style={{ minHeight: '297mm' }}
              >
                {/* Header Judul Berita Acara */}
                <div className="text-center font-bold text-sm mb-4 tracking-wide uppercase">
                  <div>BERITA ACARA</div>
                  <div>PERHITUNGAN UANG KAS</div>
                  <div className="text-base font-extrabold">{schoolSettings.schoolName || 'SMK MUHAMMADIYAH 1 NGADIREJO'}</div>
                  <div className="text-xs font-semibold capitalize">Per {activeMemorial.countDate || activeMemorial.date || `${activeMemorial.month} ${activeMemorial.year}`}</div>
                </div>

                <div className="border-b-2 border-black my-4" />

                {/* Ringkasan Saldo dan Pengeluaran Kas Tunai */}
                <div className="text-xs space-y-2 mb-4">
                  <div className="flex justify-between items-center max-w-xl">
                    <span>Saldo kecil / kas tunai per tanggal {activeMemorial.countDate || activeMemorial.date}</span>
                    <span className="font-mono font-medium">Rp. {formatRupiah(activeMemorial.remainingBalance)},-</span>
                  </div>
                  <div className="flex justify-between items-center max-w-xl">
                    <span>Jumlah Pengeluaran Kas Tunai Bulan {activeMemorial.month} {activeMemorial.year}</span>
                    <span className="font-mono font-medium">Rp. {formatRupiah(activeMemorial.totalExpense)},-</span>
                  </div>
                </div>

                <div className="border-b-2 border-black my-4" />

                {/* Pembuka Rincian */}
                <p className="text-xs mb-4">
                  Perhitungan uang kas per {activeMemorial.countDate || activeMemorial.date} menghasilkan jumlah sebagai berikut :
                </p>

                {/* Rincian Fisik Uang */}
                <div className="text-xs space-y-4 mb-6 pl-2">
                  {/* 1. Uang Kertas */}
                  <div>
                    <div className="font-bold mb-1.5">1. Uang kertas</div>
                    <div className="pl-4 space-y-1 font-mono">
                      {(activeMemorial.paperNotes || []).filter(p => p.quantity > 0).length === 0 ? (
                        <div className="text-gray-500 italic text-[11px]">- Tidak ada catatan lembar uang kertas -</div>
                      ) : (
                        (activeMemorial.paperNotes || []).filter(p => p.quantity > 0).map((note, idx) => (
                          <div key={idx} className="flex items-center max-w-lg">
                            <span className="w-40">{note.quantity} lembar @ Rp. {formatRupiah(note.nominal)},-</span>
                            <span className="w-8 text-center">=</span>
                            <span className="w-32 text-right">Rp. {formatRupiah(note.subtotal)},-</span>
                          </div>
                        ))
                      )}
                      <div className="border-t border-black max-w-lg pt-1 flex items-center justify-end font-bold">
                        <span className="w-32 text-right">Rp. {formatRupiah(activeMemorial.totalPaperAmount || (activeMemorial.paperNotes || []).reduce((a, b) => a + (b.subtotal || 0), 0))},-</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Uang Logam */}
                  <div>
                    <div className="font-bold mb-1.5">2. Uang logam</div>
                    <div className="pl-4 space-y-1 font-mono">
                      {(activeMemorial.coins || []).filter(c => c.quantity > 0).length === 0 ? (
                        <div className="flex items-center max-w-lg">
                          <span className="w-40">keping @.-</span>
                          <span className="w-8 text-center">=</span>
                          <span className="w-32 text-right">Rp. -</span>
                        </div>
                      ) : (
                        (activeMemorial.coins || []).filter(c => c.quantity > 0).map((coin, idx) => (
                          <div key={idx} className="flex items-center max-w-lg">
                            <span className="w-40">{coin.quantity} keping @ Rp. {formatRupiah(coin.nominal)},-</span>
                            <span className="w-8 text-center">=</span>
                            <span className="w-32 text-right">Rp. {formatRupiah(coin.subtotal)},-</span>
                          </div>
                        ))
                      )}
                      <div className="border-t border-black max-w-lg pt-1 flex items-center justify-end font-bold">
                        <span className="w-32 text-right">Rp. {formatRupiah(activeMemorial.totalCoinAmount || (activeMemorial.coins || []).reduce((a, b) => a + (b.subtotal || 0), 0))},-</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pernyataan Kesesuaian Saldo */}
                <p className="text-xs mb-12 leading-relaxed">
                  {activeMemorial.differenceNote || `Saldo kas kecil per ${activeMemorial.countDate || activeMemorial.date} sama dengan kas tunai yang dihitung pada tanggal tersebut.`}
                </p>

                {/* Kolom Tanda Tangan (2 Kolom: Kepala Sekolah & Bendahara Kas Tunai) */}
                <div className="grid grid-cols-2 gap-8 text-xs text-center font-normal mt-16 max-w-2xl mx-auto">
                  {/* Kolom Kiri: Kepala Sekolah */}
                  <div className="flex flex-col items-center justify-between h-36">
                    <div className="space-y-1">
                      <div className="opacity-0">.</div>
                      <div>Kepala Sekolah</div>
                    </div>
                    <div className="space-y-0.5 font-bold">
                      <div>{activeMemorial.approverName || '.......................'}</div>
                      {activeMemorial.approverNbm && (
                        <div className="font-normal font-mono text-[11px]">
                          NBM. {activeMemorial.approverNbm}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Kolom Kanan: Bendahara Kas Tunai */}
                  <div className="flex flex-col items-center justify-between h-36">
                    <div className="space-y-1">
                      <div>{activeMemorial.city || 'Ngadirejo'}, {activeMemorial.countDate || activeMemorial.date || '...................'}</div>
                      <div>Bendahara kas tunai</div>
                    </div>
                    <div className="space-y-0.5 font-bold">
                      <div>{activeMemorial.makerName || '.......................'}</div>
                      {activeMemorial.makerNbm && (
                        <div className="font-normal font-mono text-[11px]">
                          NBM. {activeMemorial.makerNbm}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODE 2: LIST VIEW OF MEMORIAL KAS TUNAI                       */}
      {/* ------------------------------------------------------------- */}
      {mode === 'list' && (
        <div className="space-y-8">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-natural-primary/10 rounded-2xl flex items-center justify-center text-natural-primary">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-3xl font-serif italic text-natural-primary tracking-tight">Memorial Kas Tunai</h2>
                  <p className="text-natural-secondary text-xs uppercase tracking-widest font-bold mt-1">
                    Persetujuan Pengisian Kembali Kas Tunai & Berita Acara Kas Opname
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenCreate}
                className="bg-natural-primary text-white px-6 py-3.5 rounded-full font-serif italic flex items-center gap-2 hover:bg-natural-primary/90 transition-all shadow-lg cursor-pointer text-sm"
              >
                <Plus className="w-4 h-4" />
                Buat Memorial Baru
              </button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white p-6 rounded-[32px] border border-natural-border shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Filter Bulan */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-natural-secondary mb-1.5">
                  Filter Bulan
                </label>
                <select
                  className="w-full p-3 bg-natural-bg/50 border border-natural-border rounded-2xl font-bold text-natural-primary text-xs focus:outline-hidden focus:border-natural-primary"
                  value={selectedMonthFilter}
                  onChange={e => setSelectedMonthFilter(e.target.value)}
                >
                  <option value="ALL">-- Semua Bulan --</option>
                  {INDONESIAN_MONTH_NAMES.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Filter Tahun */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-natural-secondary mb-1.5">
                  Filter Tahun
                </label>
                <select
                  className="w-full p-3 bg-natural-bg/50 border border-natural-border rounded-2xl font-bold text-natural-primary text-xs focus:outline-hidden focus:border-natural-primary font-mono"
                  value={selectedYearFilter}
                  onChange={e => setSelectedYearFilter(e.target.value)}
                >
                  <option value="ALL">-- Semua Tahun --</option>
                  {availableYearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Search Bar */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-natural-secondary mb-1.5">
                  Cari Dokumen Memorial
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-natural-secondary absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari bulan, tahun, atau tanggal..."
                    className="w-full pl-11 pr-4 py-3 bg-natural-bg/50 border border-natural-border rounded-2xl text-xs text-natural-primary focus:outline-hidden focus:border-natural-primary"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Records List */}
          <div className="bg-white rounded-[32px] border border-natural-border shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-natural-border/60 bg-natural-bg/20 flex items-center justify-between">
              <span className="text-xs font-bold text-natural-primary uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-natural-primary" />
                Daftar Dokumen Memorial Kas Tunai ({filteredMemorials.length})
              </span>
              {(selectedMonthFilter !== 'ALL' || selectedYearFilter !== 'ALL') && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full">
                  Periode: {selectedMonthFilter === 'ALL' ? 'Semua Bulan' : selectedMonthFilter} {selectedYearFilter === 'ALL' ? 'Semua Tahun' : selectedYearFilter}
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-16 text-center text-natural-secondary italic text-xs">Memuat data Memorial Kas Tunai...</div>
            ) : filteredMemorials.length === 0 ? (
              <div className="p-16 text-center text-natural-secondary italic text-xs space-y-3">
                <p>
                  {selectedMonthFilter !== 'ALL' || selectedYearFilter !== 'ALL' || searchTerm
                    ? 'Tidak ada dokumen Memorial Kas Tunai untuk filter yang dipilih.'
                    : 'Belum ada dokumen Memorial Kas Tunai yang dibuat.'}
                </p>
                <div className="flex items-center justify-center gap-3">
                  {(selectedMonthFilter !== 'ALL' || selectedYearFilter !== 'ALL' || searchTerm) && (
                    <button
                      onClick={() => {
                        setSelectedMonthFilter('ALL');
                        setSelectedYearFilter('ALL');
                        setSearchTerm('');
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-natural-bg border border-natural-border text-natural-primary rounded-full text-xs font-bold hover:bg-natural-border/50 transition-all cursor-pointer"
                    >
                      Tampilkan Semua Periode
                    </button>
                  )}
                  <button
                    onClick={handleOpenCreate}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-natural-primary/10 text-natural-primary rounded-full font-serif italic text-xs font-bold hover:bg-natural-primary hover:text-white transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Buat Memorial Baru
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-natural-border/40">
                {filteredMemorials.map(memo => (
                  <div key={memo.id} className="p-6 hover:bg-natural-bg/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          BULAN {memo.month} {memo.year}
                        </span>
                        <span className="text-xs text-natural-secondary font-medium">
                          {memo.city || 'Ngadirejo'}, {memo.date}
                        </span>
                        {memo.isPosted ? (
                          <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 border border-blue-300 rounded-full text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            Terposting ke Buku Kas
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-semibold">
                            Belum Diposting
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-bold text-natural-primary font-serif italic">
                        Pengisian Kembali Kas: <span className="font-mono text-emerald-700">Rp. {formatRupiah(memo.replenishmentAmount)},-</span>
                      </div>

                      <div className="text-[11px] text-natural-secondary flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>Saldo Awal (Plafon): <strong className="font-mono">Rp. {formatRupiah(memo.initialBalance)}</strong></span>
                        <span>• Total Pengeluaran: <strong className="font-mono">Rp. {formatRupiah(memo.totalExpense)}</strong></span>
                        <span>• Sisa Saldo Kas: <strong className="font-mono">Rp. {formatRupiah(memo.remainingBalance)}</strong></span>
                        <span>• Fisik Kas Terhitung: <strong className="font-mono text-emerald-800">Rp. {formatRupiah(memo.totalPhysicalCash || memo.remainingBalance)}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      {memo.isPosted ? (
                        <button
                          onClick={() => handleUnpostFromBukuKas(memo)}
                          className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Batalkan posting ke Buku Kas"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          Batal Posting
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePostToBukuKas(memo)}
                          className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                          title="Posting ke Buku Kas sebagai Pengeluaran Kas Tunai (Pengisian Kembali)"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          Posting ke Buku Kas
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenPrint(memo, 'all')}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                        title="Cetak Dokumen Persetujuan & Berita Acara (A4)"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Cetak / PDF
                      </button>

                      <button
                        onClick={() => handleOpenEdit(memo)}
                        className="p-2.5 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-2xl transition-all cursor-pointer border border-amber-200"
                        title="Edit Memorial"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => memo.id && handleDeleteMemorial(memo.id, `Bulan ${memo.month} ${memo.year}`, memo.cashOutflowId)}
                        className="p-2.5 text-red-500 bg-red-50 hover:bg-red-100 rounded-2xl transition-all cursor-pointer border border-red-200"
                        title="Hapus Memorial"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODE 3: CREATE OR EDIT FORM                                   */}
      {/* ------------------------------------------------------------- */}
      {(mode === 'create' || mode === 'edit') && (
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="bg-white p-8 sm:p-10 rounded-[40px] border border-natural-border shadow-sm space-y-8">
            <div className="flex items-center justify-between pb-6 border-b border-natural-border/60">
              <div>
                <h3 className="text-2xl font-serif italic text-natural-primary">
                  {mode === 'create' ? 'Buat Dokumen Memorial Kas Tunai Baru' : 'Edit Dokumen Memorial Kas Tunai'}
                </h3>
                <p className="text-xs text-natural-secondary mt-0.5">
                  Isi pengajuan pengisian kembali kas tunai dan rincian fisik uang (kas opname)
                </p>
              </div>

              <button
                onClick={() => setMode('list')}
                className="px-5 py-2.5 border border-natural-border text-natural-secondary rounded-full text-xs font-bold hover:bg-natural-bg transition-all flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Batal
              </button>
            </div>

            <form onSubmit={handleSaveMemorial} className="space-y-8 text-xs">
              {/* SECTION 1: Periode & Tanggal */}
              <div className="space-y-4 p-6 bg-natural-bg/30 border border-natural-border rounded-3xl">
                <h4 className="font-bold text-natural-primary text-xs uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  1. Periode & Tanggal Pembuatan Dokumen
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block font-bold text-natural-secondary mb-1">Bulan Memorial</label>
                    <select
                      className="w-full p-3 bg-white border border-natural-border rounded-xl font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary"
                      value={month}
                      onChange={e => setMonth(e.target.value)}
                    >
                      {INDONESIAN_MONTH_NAMES.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-natural-secondary mb-1">Tahun</label>
                    <input
                      type="text"
                      required
                      className="w-full p-3 bg-white border border-natural-border rounded-xl font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary font-mono"
                      value={year}
                      onChange={e => setYear(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-natural-secondary mb-1">Kota Pembuatan</label>
                    <input
                      type="text"
                      required
                      className="w-full p-3 bg-white border border-natural-border rounded-xl font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-natural-secondary mb-1">Tanggal Dokumen (e.g. 17 April 2026)</label>
                    <input
                      type="text"
                      required
                      className="w-full p-3 bg-white border border-natural-border rounded-xl font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Persetujuan Pengisian Kembali Kas Tunai */}
              <div className="space-y-4 p-6 bg-natural-bg/30 border border-natural-border rounded-3xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="font-bold text-natural-primary text-xs uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    2. Rincian Persetujuan Pengisian Kembali Kas Tunai
                  </h4>

                  <button
                    type="button"
                    onClick={handleAutoCalculateExpenseFromBKK}
                    className="px-3.5 py-1.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] hover:bg-emerald-200 transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                    title="Hitung total pengeluaran kas tunai bulan ini dari transaksi Buku Kas"
                  >
                    <Calculator className="w-3 h-3" /> Hitung dari Buku Kas
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block font-bold text-natural-secondary mb-1">
                      Saldo Awal Kas Tunai (Plafon Kas) (Rp):
                    </label>
                    <input
                      type="number"
                      required
                      className="w-full p-3 bg-white border border-natural-border rounded-xl font-mono font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary"
                      value={initialBalance}
                      onChange={e => handleInitialBalanceChange(Number(e.target.value))}
                    />
                    <span className="text-[10px] text-natural-secondary mt-1 block">
                      Jumlah dana kas kecil yang ditetapkan (contoh: Rp 5.000.000)
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-natural-secondary mb-1">
                      Total Pengeluaran Kas Tunai Bulan Ini (Rp):
                    </label>
                    <input
                      type="number"
                      required
                      className="w-full p-3 bg-white border border-natural-border rounded-xl font-mono font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary"
                      value={totalExpense}
                      onChange={e => handleTotalExpenseChange(Number(e.target.value))}
                    />
                    <span className="text-[10px] text-natural-secondary mt-1 block">
                      Total pengeluaran operasional yang telah dipakai
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block font-bold text-natural-secondary mb-1">
                      Sisa Saldo Kas Tunai (Rp):
                    </label>
                    <input
                      type="number"
                      required
                      className="w-full p-3 bg-white border border-natural-border rounded-xl font-mono font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary"
                      value={remainingBalance}
                      onChange={e => setRemainingBalance(Number(e.target.value))}
                    />
                    <span className="text-[10px] text-natural-secondary mt-1 block">
                      Otomatis: Saldo Awal - Total Pengeluaran = Rp {formatRupiah(remainingBalance)}
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-natural-secondary mb-1">
                      Jumlah Pengisian Kembali Kas Tunai (Rp):
                    </label>
                    <input
                      type="number"
                      required
                      className="w-full p-3 bg-emerald-50 border border-emerald-300 rounded-xl font-mono font-bold text-emerald-900 focus:outline-hidden focus:border-emerald-600"
                      value={replenishmentAmount}
                      onChange={e => setReplenishmentAmount(Number(e.target.value))}
                    />
                    <span className="text-[10px] text-emerald-700 mt-1 block font-medium">
                      Dana yang diajukan untuk mengisi kembali kas tunai (biasanya sama dengan pengeluaran)
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Berita Acara Kas Opname / Perhitungan Fisik */}
              <div className="space-y-4 p-6 bg-natural-bg/30 border border-natural-border rounded-3xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="font-bold text-natural-primary text-xs uppercase tracking-wider flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-600" />
                    3. Berita Acara Perhitungan Uang Kas (Kas Opname)
                  </h4>

                  <button
                    type="button"
                    onClick={handleAutoFillPhysicalCash}
                    className="px-3.5 py-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full font-bold text-[10px] hover:bg-blue-100 transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                    title="Otomatis isi pecahan uang sesuai Sisa Saldo Kas Tunai"
                  >
                    <Calculator className="w-3 h-3" /> Auto-Fill Pecahan Uang
                  </button>
                </div>

                <div>
                  <label className="block font-bold text-natural-secondary mb-1">
                    Tanggal Perhitungan Fisik Kas (e.g. 30 Juni 2026 / 17 April 2026):
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 bg-white border border-natural-border rounded-xl font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary"
                    value={countDate}
                    onChange={e => setCountDate(e.target.value)}
                    placeholder="e.g. 30 Juni 2026"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Uang Kertas Input Table */}
                  <div className="bg-white p-4 rounded-2xl border border-natural-border space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-bold text-natural-primary text-xs uppercase">1. Pecahan Uang Kertas</span>
                      <span className="font-mono font-bold text-emerald-800 text-xs">
                        Rp {formatRupiah(calculatedTotalPaper)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {paperNotes.map(p => (
                        <div key={p.nominal} className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono text-natural-primary font-medium w-28">
                            Rp {formatRupiah(p.nominal)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              className="w-20 p-1.5 bg-natural-bg/40 border border-natural-border rounded-lg text-center font-mono font-bold text-natural-primary focus:bg-white"
                              value={p.quantity === 0 ? '' : p.quantity}
                              placeholder="0"
                              onChange={e => handlePaperQuantityChange(p.nominal, parseInt(e.target.value, 10))}
                            />
                            <span className="text-[10px] text-natural-secondary font-medium">lembar</span>
                          </div>
                          <span className="font-mono text-right w-28 text-natural-primary font-bold">
                            Rp {formatRupiah(p.quantity * p.nominal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Uang Logam Input Table */}
                  <div className="bg-white p-4 rounded-2xl border border-natural-border space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-bold text-natural-primary text-xs uppercase">2. Pecahan Uang Logam</span>
                      <span className="font-mono font-bold text-emerald-800 text-xs">
                        Rp {formatRupiah(calculatedTotalCoin)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {coins.map(c => (
                        <div key={c.nominal} className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono text-natural-primary font-medium w-28">
                            Rp {formatRupiah(c.nominal)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              className="w-20 p-1.5 bg-natural-bg/40 border border-natural-border rounded-lg text-center font-mono font-bold text-natural-primary focus:bg-white"
                              value={c.quantity === 0 ? '' : c.quantity}
                              placeholder="0"
                              onChange={e => handleCoinQuantityChange(c.nominal, parseInt(e.target.value, 10))}
                            />
                            <span className="text-[10px] text-natural-secondary font-medium">keping</span>
                          </div>
                          <span className="font-mono text-right w-28 text-natural-primary font-bold">
                            Rp {formatRupiah(c.quantity * c.nominal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Ringkasan Kesesuaian Fisik Kas */}
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">
                      Total Fisik Uang Kas Terhitung:
                    </span>
                    <span className="text-base font-mono font-bold text-emerald-900">
                      Rp. {formatRupiah(calculatedTotalPhysicalCash)},-
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold text-natural-secondary uppercase tracking-wider block">
                      Status Kesesuaian Fisik vs Sisa Kas:
                    </span>
                    {calculatedTotalPhysicalCash === remainingBalance ? (
                      <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Fisik Kas Sesuai (Selisih Rp 0)
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-amber-700 flex items-center gap-1 font-mono">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Selisih: Rp {formatRupiah(calculatedTotalPhysicalCash - remainingBalance)}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-natural-secondary mb-1">
                    Catatan Kesesuaian / Keterangan Berita Acara (Opsional):
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 bg-white border border-natural-border rounded-xl font-medium text-natural-primary"
                    value={differenceNote}
                    onChange={e => setDifferenceNote(e.target.value)}
                    placeholder={`Saldo kas kecil per ${countDate || date} sama dengan kas tunai yang dihitung pada tanggal tersebut.`}
                  />
                </div>
              </div>

              {/* SECTION 4: Pejabat Penandatangan */}
              <div className="space-y-4 p-6 bg-natural-bg/30 border border-natural-border rounded-3xl">
                <h4 className="font-bold text-natural-primary text-xs uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  4. Pejabat Penandatangan Dokumen
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Kolom 1: Kepala Sekolah */}
                  <div className="p-4 bg-white border border-natural-border rounded-2xl space-y-3">
                    <span className="block font-bold text-emerald-800 text-[10px] uppercase border-b pb-1">
                      1. Kepala Sekolah (Disetujui Oleh)
                    </span>
                    <div>
                      <label className="block text-[10px] text-natural-secondary font-bold">Tanggal Disetujui:</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-natural-bg/40 border border-natural-border rounded-lg font-bold text-natural-primary text-xs"
                        value={approverDate}
                        onChange={e => setApproverDate(e.target.value)}
                        placeholder="............"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-natural-secondary font-bold">Nama Kepala Sekolah:</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-natural-bg/40 border border-natural-border rounded-lg font-bold text-natural-primary text-xs"
                        value={approverName}
                        onChange={e => setApproverName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-natural-secondary font-bold">NBM:</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-natural-bg/40 border border-natural-border rounded-lg font-mono font-bold text-natural-primary text-xs"
                        value={approverNbm}
                        onChange={e => setApproverNbm(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Kolom 2: Diperiksa Oleh */}
                  <div className="p-4 bg-white border border-natural-border rounded-2xl space-y-3">
                    <span className="block font-bold text-emerald-800 text-[10px] uppercase border-b pb-1">
                      2. Diperiksa Oleh (Waka / Pemeriksa)
                    </span>
                    <div>
                      <label className="block text-[10px] text-natural-secondary font-bold">Nama Pemeriksa:</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-natural-bg/40 border border-natural-border rounded-lg font-bold text-natural-primary text-xs"
                        value={checkerName}
                        onChange={e => setCheckerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-natural-secondary font-bold">NBM:</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-natural-bg/40 border border-natural-border rounded-lg font-mono font-bold text-natural-primary text-xs"
                        value={checkerNbm}
                        onChange={e => setCheckerNbm(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Kolom 3: Bendahara Kas Tunai (Dibuat Oleh) */}
                  <div className="p-4 bg-white border border-natural-border rounded-2xl space-y-3">
                    <span className="block font-bold text-emerald-800 text-[10px] uppercase border-b pb-1">
                      3. Dibuat Oleh (Bendahara Kas Tunai)
                    </span>
                    <div>
                      <label className="block text-[10px] text-natural-secondary font-bold">Nama Bendahara Kas:</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-natural-bg/40 border border-natural-border rounded-lg font-bold text-natural-primary text-xs"
                        value={makerName}
                        onChange={e => setMakerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-natural-secondary font-bold">NBM:</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-natural-bg/40 border border-natural-border rounded-lg font-mono font-bold text-natural-primary text-xs"
                        value={makerNbm}
                        onChange={e => setMakerNbm(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-natural-border">
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="px-6 py-3 rounded-full border border-natural-border text-natural-secondary font-bold hover:bg-natural-bg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-natural-primary text-white font-bold rounded-full hover:bg-natural-primary/90 shadow-md cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Simpan Dokumen Memorial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
