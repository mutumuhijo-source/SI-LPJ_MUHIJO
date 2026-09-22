import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileCheck2, 
  Plus, 
  Trash2, 
  Pencil, 
  Printer, 
  ArrowLeft, 
  Search, 
  Building2, 
  CheckCircle2, 
  Calendar, 
  CreditCard, 
  PlusCircle, 
  UserCheck, 
  FileText,
  DollarSign,
  Wallet,
  Send,
  RotateCw
} from 'lucide-react';
import { SchoolSettings, Report, BudgetMemo, BudgetMemoItem, OperationType } from '../types';
import { Firestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { safeAlert, safeConfirm } from '../lib/utils';
import { handleFirestoreError } from '../lib/error-handler';
import { calculateBkkEndingBalance, getBkkSettingsFromCache } from '../lib/bkk-calculator';

interface MemoBudgetPageProps {
  db: Firestore;
  schoolSettings: SchoolSettings;
  reports: Report[];
  userEmail: string;
}

export const MemoBudgetPage: React.FC<MemoBudgetPageProps> = ({
  db,
  schoolSettings,
  reports,
  userEmail,
}) => {
  const [memos, setMemos] = useState<BudgetMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'create' | 'edit' | 'print'>('list');
  const [activeMemo, setActiveMemo] = useState<BudgetMemo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Default month and year filter set to current month & year
  const currentNow = new Date();
  const indonesianMonthNames = [
    'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
    'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
  ];
  const defaultCurrentMonth = indonesianMonthNames[currentNow.getMonth()];
  const defaultCurrentYear = String(currentNow.getFullYear());

  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>(defaultCurrentMonth);
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>(defaultCurrentYear);

  // States for calculating current Buku Kas ending balance
  const [bkkSettings, setBkkSettings] = useState<{ initialBalance: number; initialBalanceDate?: string }>(() => getBkkSettingsFromCache());
  const [cashInflows, setCashInflows] = useState<any[]>([]);
  const [directOutflows, setDirectOutflows] = useState<any[]>([]);

  // Form states
  const [week, setWeek] = useState('MINGGU 2');
  const [month, setMonth] = useState('SEPTEMBER');
  const [year, setYear] = useState('2026');
  
  const [operationalAccountName, setOperationalAccountName] = useState('BANK BTM KOMITE (5.02.00097)');
  const [operationalBalance, setOperationalBalance] = useState<number>(0);
  
  const [transferAccountName, setTransferAccountName] = useState('PEMASUKAN (5.02.00716)');
  
  const [items, setItems] = useState<BudgetMemoItem[]>([]);
  
  // Custom item state
  const [customActivity, setCustomActivity] = useState('');
  const [customAmount, setCustomAmount] = useState<number | ''>('');
  
  // Budget dropdown selection
  const [selectedReportId, setSelectedReportId] = useState('');

  // Signatories & Meta
  const [memoCity, setMemoCity] = useState('Ngadirejo');
  const [memoDate, setMemoDate] = useState('');

  const [approverName, setApproverName] = useState('');
  const [approverNbm, setApproverNbm] = useState('');

  const [checkerName, setCheckerName] = useState('');
  const [checkerNbm, setCheckerNbm] = useState('');

  const [makerName, setMakerName] = useState('');
  const [makerNbm, setMakerNbm] = useState('');

  // Print ref
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Subscribe to BKK data for calculating current Buku Kas ending balance
  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'bkk_settings', 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setBkkSettings({
          initialBalance: Number(data.initialBalance) || 0,
          initialBalanceDate: data.initialBalanceDate || '2026-09-01'
        });
      }
    }, (err) => console.warn("Error fetching bkk_settings:", err));

    const unsubInflows = onSnapshot(collection(db, 'cash_inflows'), (snap) => {
      setCashInflows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.warn("Error fetching cash_inflows:", err));

    const unsubOutflows = onSnapshot(collection(db, 'direct_cash_outflows'), (snap) => {
      setDirectOutflows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.warn("Error fetching direct_cash_outflows:", err));

    return () => {
      unsubSettings();
      unsubInflows();
      unsubOutflows();
    };
  }, [db]);

  // Compute current real-time ending balance of Buku Kas
  const calculateCurrentBkkEndingBalance = (): number => {
    return calculateBkkEndingBalance(bkkSettings, cashInflows, directOutflows, reports);
  };

  // Subscribe to budget_memos
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'budget_memos'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as BudgetMemo));
      // Sort newest first
      data.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setMemos(data);
      setLoading(false);
    }, (err) => {
      console.warn("Error fetching budget_memos:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  // Approved reports available for selection
  const approvedReports = reports.filter(r => 
    r.status === 'budget_approved' || 
    r.status === 'reporting' || 
    r.status === 'completed' || 
    r.approvedAt != null
  );

  // Helper formatting numbers to Rupiah string
  const formatRupiah = (val: number) => {
    if (isNaN(val)) return '0';
    return new Intl.NumberFormat('id-ID').format(val);
  };

  // Prepopulate form when creating new
  const handleOpenCreate = () => {
    setActiveMemo(null);
    const now = new Date();
    const months = [
      'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
      'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
    ];
    
    setWeek('MINGGU 2');
    setMonth(months[now.getMonth()]);
    setYear(String(now.getFullYear()));
    setOperationalAccountName('BANK BTM KOMITE (5.02.00097)');
    
    // Auto-pull ending balance from Buku Kas
    const currentBkkBalance = calculateCurrentBkkEndingBalance();
    setOperationalBalance(currentBkkBalance);
    
    setTransferAccountName('PEMASUKAN (5.02.00716)');
    
    // Default items array
    setItems([]);
    
    // Default city & date
    setMemoCity(schoolSettings.memoCity || 'Ngadirejo');
    
    const formattedDateStr = `${now.getDate()} ${months[now.getMonth()].charAt(0) + months[now.getMonth()].slice(1).toLowerCase()} ${now.getFullYear()}`;
    setMemoDate(formattedDateStr);

    // Signatories from school settings
    setApproverName(schoolSettings.memoApproverName || schoolSettings.principalName || '');
    setApproverNbm(schoolSettings.memoApproverNbm || schoolSettings.principalNbm || '');

    setCheckerName(schoolSettings.memoCheckerName || '');
    setCheckerNbm(schoolSettings.memoCheckerNbm || '');

    setMakerName(schoolSettings.memoMakerName || schoolSettings.treasurerName || '');
    setMakerNbm(schoolSettings.memoMakerNbm || schoolSettings.treasurerNbm || '');

    setMode('create');
  };

  // Load existing memo to edit
  const handleOpenEdit = (memo: BudgetMemo) => {
    setActiveMemo(memo);
    setWeek(memo.week || 'MINGGU 2');
    setMonth(memo.month || 'SEPTEMBER');
    setYear(memo.year || '2026');
    setOperationalAccountName(memo.operationalAccountName || 'BANK BTM KOMITE (5.02.00097)');
    setOperationalBalance(memo.operationalBalance || 0);
    setTransferAccountName(memo.transferAccountName || 'PEMASUKAN (5.02.00716)');
    setItems(memo.items || []);
    
    setMemoCity(memo.memoCity || schoolSettings.memoCity || 'Ngadirejo');
    setMemoDate(memo.memoDate || '');

    setApproverName(memo.approverName || '');
    setApproverNbm(memo.approverNbm || '');

    setCheckerName(memo.checkerName || '');
    setCheckerNbm(memo.checkerNbm || '');

    setMakerName(memo.makerName || '');
    setMakerNbm(memo.makerNbm || '');

    setMode('edit');
  };

  const handleOpenPrint = (memo: BudgetMemo) => {
    setActiveMemo(memo);
    setMode('print');
  };

  // Add report from dropdown
  const handleAddApprovedReportItem = () => {
    if (!selectedReportId) return;
    const rep = approvedReports.find(r => r.id === selectedReportId);
    if (!rep) return;

    // Check if already in items
    const alreadyExists = items.some(i => i.reportId === rep.id);
    if (alreadyExists) {
      safeAlert('Anggaran kegiatan ini sudah ada di dalam tabel.');
      return;
    }

    const newItem: BudgetMemoItem = {
      reportId: rep.id,
      activityName: rep.activityName,
      amount: rep.amountReceived || rep.totalSpent || 0,
      isCustom: false
    };

    setItems(prev => [...prev, newItem]);
    setSelectedReportId('');
  };

  // Add custom manual item
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customActivity.trim() || !customAmount || Number(customAmount) <= 0) {
      safeAlert('Nama kegiatan dan jumlah nominal harus diisi dengan benar');
      return;
    }

    const newItem: BudgetMemoItem = {
      activityName: customActivity.trim(),
      amount: Number(customAmount),
      isCustom: true
    };

    setItems(prev => [...prev, newItem]);
    setCustomActivity('');
    setCustomAmount('');
  };

  // Remove item from table
  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Update item amount inline
  const handleUpdateItemAmount = (index: number, newAmount: number) => {
    setItems(prev => prev.map((item, idx) => idx === index ? { ...item, amount: newAmount } : item));
  };

  // Calculate totals
  const totalTransferAmount = items.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalBalanceAfter = (Number(operationalBalance) || 0) + totalTransferAmount;

  // Save or Update memo
  const handleSaveMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      safeAlert('Tabel pengeluaran tidak boleh kosong. Harap tambahkan minimal 1 item anggaran.');
      return;
    }

    const memoPayload: Partial<BudgetMemo> = {
      week: week.toUpperCase(),
      month: month.toUpperCase(),
      year: year.trim(),
      schoolName: schoolSettings.schoolName || 'SMK MUHAMMADIYAH 1 NGADIREJO',
      
      operationalAccountName,
      operationalBalance: Number(operationalBalance) || 0,
      
      transferAccountName,
      transferAmount: totalTransferAmount,
      totalBalanceAfter,
      
      items,

      memoCity,
      memoDate,

      approverTitle: 'Disetujui Oleh,',
      approverName,
      approverNbm,

      checkerTitle: 'Diperiksa Oleh,',
      checkerName,
      checkerNbm,

      makerTitle: 'Dibuat Oleh,',
      makerName,
      makerNbm,

      updatedAt: serverTimestamp(),
      createdBy: userEmail
    };

    try {
      if (mode === 'create') {
        memoPayload.createdAt = serverTimestamp();
        await addDoc(collection(db, 'budget_memos'), memoPayload);
        safeAlert('Memo Budget Mingguan berhasil disimpan ke riwayat!');
      } else if (mode === 'edit' && activeMemo?.id) {
        await updateDoc(doc(db, 'budget_memos', activeMemo.id), memoPayload);
        safeAlert('Memo Budget Mingguan berhasil diperbarui!');
      }
      setMode('list');
    } catch (err) {
      handleFirestoreError(err, mode === 'create' ? OperationType.CREATE : OperationType.UPDATE, 'budget_memos');
    }
  };

  // Delete memo
  const handleDeleteMemo = async (id: string, name: string) => {
    if (safeConfirm(`Hapus memo "${name}" dari riwayat?`)) {
      try {
        await deleteDoc(doc(db, 'budget_memos', id));
        safeAlert('Memo berhasil dihapus.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `budget_memos/${id}`);
      }
    }
  };

  // Helper to convert memo date string to ISO YYYY-MM-DD
  const convertMemoDateToIso = (memoDateStr?: string, yearStr?: string, monthStr?: string): string => {
    if (!memoDateStr) return new Date().toISOString().split('T')[0];

    const monthMap: Record<string, string> = {
      januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
      juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12'
    };

    const cleanStr = memoDateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
      return cleanStr;
    }

    const parts = cleanStr.split(/\s+/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const monthName = parts[1].toLowerCase();
      const year = parts[2];
      if (monthMap[monthName] && /^\d{4}$/.test(year) && /^\d{1,2}$/.test(day)) {
        return `${year}-${monthMap[monthName]}-${day}`;
      }
    }

    if (monthStr && yearStr) {
      const monthLower = monthStr.toLowerCase();
      const monthNum = monthMap[monthLower] || '09';
      const yearNum = /^\d{4}$/.test(yearStr) ? yearStr : '2026';
      return `${yearNum}-${monthNum}-01`;
    }

    return new Date().toISOString().split('T')[0];
  };

  // Posting Memo Budget ke Buku Kas sebagai Penerimaan Pindah Buku
  const handlePostToBukuKas = async (memo: BudgetMemo) => {
    if (!memo.id) return;
    if (memo.isPosted) {
      safeAlert('Memo Budget Mingguan ini sudah diposting ke Buku Kas.');
      return;
    }

    const confirmMsg = `Posting Memo Budget Mingguan (${memo.week} BULAN ${memo.month} ${memo.year}) sebesar Rp ${formatRupiah(memo.transferAmount)} ke Buku Kas sebagai Penerimaan Pindah Buku?`;
    if (!safeConfirm(confirmMsg)) return;

    const formattedDate = convertMemoDateToIso(memo.memoDate, memo.year, memo.month);
    const generatedNoBukti = `BKM/MB-${memo.week.replace(/\s+/g, '')}-${memo.month.slice(0, 3).toUpperCase()}`;

    const inflowPayload = {
      date: formattedDate,
      noBukti: generatedNoBukti,
      sourceAccount: memo.transferAccountName || 'Rekening Operasional Bank Jateng',
      category: 'Pindah Buku Rekening Bank',
      description: `Pindah buku - ${memo.week} BULAN ${memo.month} ${memo.year}`,
      amount: memo.transferAmount || 0,
      receivedFrom: memo.schoolName || schoolSettings.schoolName || 'Bendahara Sekolah',
      notes: `Otomatis diposting dari Memo Budget Mingguan (${memo.week} BULAN ${memo.month} ${memo.year})`,
      createdAt: serverTimestamp(),
      createdBy: userEmail
    };

    try {
      const docRef = await addDoc(collection(db, 'cash_inflows'), inflowPayload);

      await updateDoc(doc(db, 'budget_memos', memo.id), {
        isPosted: true,
        postedAt: serverTimestamp(),
        postedBy: userEmail,
        cashInflowId: docRef.id,
        updatedAt: serverTimestamp()
      });

      if (activeMemo && activeMemo.id === memo.id) {
        setActiveMemo({
          ...activeMemo,
          isPosted: true,
          cashInflowId: docRef.id
        });
      }

      safeAlert(`Berhasil memposting Memo Budget ke Buku Kas!\nPenerimaan Pindah Buku sebesar Rp ${formatRupiah(memo.transferAmount)} telah dicatat.`);
    } catch (err) {
      console.error('Error posting memo to Buku Kas:', err);
      handleFirestoreError(err, OperationType.CREATE, 'cash_inflows');
    }
  };

  // Batalkan Posting Memo Budget dari Buku Kas
  const handleUnpostFromBukuKas = async (memo: BudgetMemo) => {
    if (!memo.id) return;
    if (!memo.isPosted) return;

    if (!safeConfirm(`Batalkan posting Memo Budget (${memo.week} ${memo.month})? Catatan Penerimaan Pindah Buku di Buku Kas akan dihapus.`)) return;

    try {
      if (memo.cashInflowId) {
        try {
          await deleteDoc(doc(db, 'cash_inflows', memo.cashInflowId));
        } catch (delErr) {
          console.warn('Cash inflow document already removed:', delErr);
        }
      }

      await updateDoc(doc(db, 'budget_memos', memo.id), {
        isPosted: false,
        postedAt: null,
        postedBy: null,
        cashInflowId: null,
        updatedAt: serverTimestamp()
      });

      if (activeMemo && activeMemo.id === memo.id) {
        setActiveMemo({
          ...activeMemo,
          isPosted: false,
          cashInflowId: undefined
        });
      }

      safeAlert('Posting Memo Budget berhasil dibatalkan dan dihapus dari Buku Kas.');
    } catch (err) {
      console.error('Error unposting memo:', err);
      handleFirestoreError(err, OperationType.DELETE, `cash_inflows/${memo.cashInflowId}`);
    }
  };

  // Direct print function
  const handlePrintDocument = () => {
    window.print();
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

  // Dynamically collect available years from memos + current year
  const availableYearOptions = useMemo(() => {
    const yearsSet = new Set<string>();
    const currentY = String(new Date().getFullYear());
    yearsSet.add(currentY);
    yearsSet.add('2026');
    yearsSet.add('2025');

    memos.forEach(m => {
      if (m.year && /^\d{4}$/.test(m.year.trim())) {
        yearsSet.add(m.year.trim());
      }
    });

    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [memos]);

  // Filter memos by search term, selected month, and selected year
  const filteredMemos = useMemo(() => {
    return memos.filter(m => {
      const matchesSearch = !searchTerm || (
        m.week.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.month.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.year.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.items || []).some(i => i.activityName.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      const normMonth = normalizeMonthName(m.month);
      const matchesMonth = selectedMonthFilter === 'ALL' || normMonth === selectedMonthFilter;

      const memoYearStr = (m.year || '').trim();
      const matchesYear = selectedYearFilter === 'ALL' || memoYearStr === selectedYearFilter;

      return matchesSearch && matchesMonth && matchesYear;
    });
  }, [memos, searchTerm, selectedMonthFilter, selectedYearFilter]);

  return (
    <div className="space-y-8">
      {/* Printable Area Specific for Printing */}
      {mode === 'print' && activeMemo && (
        <div className="memo-print-wrapper fixed inset-0 bg-white z-50 overflow-y-auto p-4 sm:p-10 print:p-0 print:static print:bg-white">
          {/* Top Bar for Action in Preview Mode */}
          <div className="max-w-[210mm] mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4 print:hidden" data-print-hide="true">
            <button
              onClick={() => setMode('list')}
              className="px-5 py-2.5 bg-natural-bg border border-natural-border text-natural-primary rounded-full text-xs font-bold flex items-center gap-2 hover:bg-natural-border/50 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Daftar Memo
            </button>

            <div className="flex items-center gap-2">
              {activeMemo.isPosted ? (
                <button
                  onClick={() => handleUnpostFromBukuKas(activeMemo)}
                  className="px-4 py-2.5 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-all cursor-pointer"
                  title="Sudah diposting ke Buku Kas. Klik untuk membatalkan posting."
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Diposting ke Kas
                </button>
              ) : (
                <button
                  onClick={() => handlePostToBukuKas(activeMemo)}
                  className="px-5 py-2.5 bg-blue-700 text-white rounded-full text-xs font-bold flex items-center gap-2 hover:bg-blue-800 transition-all shadow-md cursor-pointer"
                  title="Posting ke Buku Kas sebagai Penerimaan Pindah Buku"
                >
                  <Send className="w-4 h-4" />
                  Posting ke Buku Kas
                </button>
              )}

              <button
                onClick={() => handleOpenEdit(activeMemo)}
                className="px-4 py-2.5 bg-amber-600 text-white rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-amber-700 transition-all shadow-md cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Memo
              </button>

              <button
                onClick={() => {
                  if (activeMemo.id && safeConfirm(`Hapus memo "${activeMemo.week} ${activeMemo.month}" dari riwayat?`)) {
                    handleDeleteMemo(activeMemo.id, `${activeMemo.week} ${activeMemo.month}`);
                    setMode('list');
                  }
                }}
                className="px-4 py-2.5 bg-red-600 text-white rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-red-700 transition-all shadow-md cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus
              </button>

              <button
                onClick={handlePrintDocument}
                className="px-6 py-2.5 bg-emerald-700 text-white rounded-full text-xs font-bold flex items-center gap-2 hover:bg-emerald-800 transition-all shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Cetak / Save PDF (A4)
              </button>
            </div>
          </div>

          {/* A4 Document Container */}
          <div 
            id="memo-budget-print-area"
            ref={printContainerRef}
            className="printable-a4-page max-w-[210mm] mx-auto bg-white p-[15mm] border border-gray-300 shadow-xl print:shadow-none print:border-none print:p-0 font-serif text-black leading-normal select-text print:min-h-0"
            style={{ minHeight: '297mm' }}
          >
            {/* Kop Surat Header Image (Only for Memo Budget if uploaded) */}
            {(schoolSettings.memoHeaderUrl || schoolSettings.kopHeaderUrl) && (
              <div className="mb-6 print:mb-4 pb-2 border-b-2 border-black text-center">
                <img 
                  src={schoolSettings.memoHeaderUrl || schoolSettings.kopHeaderUrl} 
                  alt="Kop Surat Memo Budget" 
                  className="w-full max-h-36 print:max-h-28 object-contain mx-auto"
                />
              </div>
            )}

            {/* Document Title Header */}
            <div className="text-center font-bold text-base mb-6 print:mb-4 tracking-wide uppercase">
              <div>PERSETUJUAN PENCAIRAN DANA</div>
              <div>{activeMemo.week} BULAN {activeMemo.month} {activeMemo.year}</div>
            </div>

            {/* Opening Paragraph */}
            <p className="text-xs text-justify mb-5 print:mb-3 leading-relaxed font-normal">
              Berdasarkan pengajuan Rencana Anggaran Belanja dari unit kerja {activeMemo.schoolName || schoolSettings.schoolName || 'SMK Muhammadiyah 1 Ngadirejo'}, mohon untuk dilakukan pengeluaran dari Rekening Operasional dengan rincian sebagai berikut:
            </p>

            {/* Balances Summary Section */}
            <div className="text-xs mb-6 print:mb-4 space-y-1 font-bold pl-2">
              <div className="flex justify-between items-center max-w-xl">
                <span>Saldo Operasional Rekening {activeMemo.operationalAccountName}</span>
                <span className="font-mono">Rp. {formatRupiah(activeMemo.operationalBalance)},-</span>
              </div>
              <div className="flex justify-between items-center max-w-xl">
                <span className="underline">Pindah buku dari Rekening {activeMemo.transferAccountName}</span>
                <span className="font-mono underline">Rp. {formatRupiah(activeMemo.transferAmount)},-</span>
              </div>
              <div className="flex justify-between items-center max-w-xl pt-0.5">
                <span>Total saldo setelahnya</span>
                <span className="font-mono">Rp. {formatRupiah(activeMemo.totalBalanceAfter)},-</span>
              </div>
            </div>

            {/* Expenditure Table Header */}
            <div className="text-xs mb-2 font-normal">
              Yang akan digunakan Pengeluaran sebagai berikut :
            </div>

            {/* Expenditure Table */}
            <table className="w-full text-xs border-2 border-black border-collapse mb-6 print:mb-4">
              <tbody>
                {(activeMemo.items || []).map((item, index) => (
                  <tr key={index} className="border-b border-black">
                    <td className="p-2 border-r border-black font-normal align-top">
                      {item.activityName}
                    </td>
                    <td className="p-2 text-right font-mono font-normal w-48 align-top whitespace-nowrap">
                      Rp. {formatRupiah(item.amount)},-
                    </td>
                  </tr>
                ))}
                {/* Pad empty lines if items are few to maintain structure if desired */}
                {(activeMemo.items || []).length < 2 && (
                  <tr className="border-b border-black h-8">
                    <td className="p-2 border-r border-black"></td>
                    <td className="p-2"></td>
                  </tr>
                )}
                <tr className="font-bold border-t-2 border-black">
                  <td className="p-2 border-r border-black uppercase font-bold">
                    TOTAL
                  </td>
                  <td className="p-2 text-right font-mono font-bold w-48 whitespace-nowrap">
                    Rp.{formatRupiah(activeMemo.transferAmount)},-
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Closing Paragraph */}
            <p className="text-xs mb-10 print:mb-4 leading-relaxed font-normal">
              Demikian persetujuan ini kami buat, atas perhatiannya diucapkan terima kasih.
            </p>

            {/* Signatures Block (3 Columns) */}
            <div className="grid grid-cols-3 gap-4 text-xs text-center font-normal mt-12 print:mt-6">
              {/* Column 1: Disetujui Oleh */}
              <div className="flex flex-col items-center justify-between h-40 print:h-28">
                <div className="space-y-1">
                  <div>Tanggal:.............</div>
                  <div>Disetujui Oleh,</div>
                </div>
                <div className="space-y-0.5 font-bold">
                  <div>{activeMemo.approverName || '.......................'}</div>
                  {activeMemo.approverNbm && (
                    <div className="font-normal font-mono text-[11px]">
                      NBM. {activeMemo.approverNbm}
                    </div>
                  )}
                </div>
              </div>

              {/* Column 2: Diperiksa Oleh */}
              <div className="flex flex-col items-center justify-between h-40 print:h-28">
                <div className="space-y-1">
                  <div>Tanggal:.............</div>
                  <div>Diperiksa Oleh,</div>
                </div>
                <div className="space-y-0.5 font-bold">
                  <div>{activeMemo.checkerName || '.......................'}</div>
                  {activeMemo.checkerNbm && (
                    <div className="font-normal font-mono text-[11px]">
                      NBM. {activeMemo.checkerNbm}
                    </div>
                  )}
                </div>
              </div>

              {/* Column 3: Dibuat Oleh */}
              <div className="flex flex-col items-center justify-between h-40 print:h-28">
                <div className="space-y-1">
                  <div>{activeMemo.memoCity || 'Ngadirejo'}, {activeMemo.memoDate || '...................'}</div>
                  <div>Dibuat Oleh,</div>
                </div>
                <div className="space-y-0.5 font-bold">
                  <div>{activeMemo.makerName || '.......................'}</div>
                  {activeMemo.makerNbm && (
                    <div className="font-normal font-mono text-[11px]">
                      NBM. {activeMemo.makerNbm}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode List View */}
      {mode === 'list' && (
        <div className="space-y-6">
          {/* Top Header Card */}
          <div className="bg-white p-8 rounded-[40px] border border-natural-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-100 flex-shrink-0">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-serif italic text-natural-primary">Memo Budget Mingguan</h2>
                <p className="text-xs text-natural-secondary mt-0.5">
                  Persetujuan Pencairan Dana mingguan operasional sekolah & riwayat cetak
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Filter Bulan */}
              <div className="flex items-center gap-1.5 bg-natural-bg/80 border border-natural-border px-3 py-2 rounded-full shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-natural-secondary" />
                <span className="text-[10px] uppercase font-bold text-natural-secondary">Bulan:</span>
                <select
                  value={selectedMonthFilter}
                  onChange={e => setSelectedMonthFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-natural-primary focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">Semua Bulan</option>
                  <option value="JANUARI">Januari</option>
                  <option value="FEBRUARI">Februari</option>
                  <option value="MARET">Maret</option>
                  <option value="APRIL">April</option>
                  <option value="MEI">Mei</option>
                  <option value="JUNI">Juni</option>
                  <option value="JULI">Juli</option>
                  <option value="AGUSTUS">Agustus</option>
                  <option value="SEPTEMBER">September</option>
                  <option value="OKTOBER">Oktober</option>
                  <option value="NOVEMBER">November</option>
                  <option value="DESEMBER">Desember</option>
                </select>
              </div>

              {/* Filter Tahun */}
              <div className="flex items-center gap-1.5 bg-natural-bg/80 border border-natural-border px-3 py-2 rounded-full shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-natural-secondary">Tahun:</span>
                <select
                  value={selectedYearFilter}
                  onChange={e => setSelectedYearFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-natural-primary focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">Semua Tahun</option>
                  {availableYearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Input Pencarian */}
              <div className="relative flex-1 md:w-44">
                <Search className="w-3.5 h-3.5 text-natural-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari memo..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-natural-bg/50 border border-natural-border rounded-full text-xs font-medium focus:bg-white focus:outline-hidden focus:border-natural-primary"
                />
              </div>

              <button
                onClick={handleOpenCreate}
                className="bg-natural-primary text-white px-5 py-2.5 rounded-full font-serif italic text-xs font-bold hover:bg-natural-primary/90 transition-all shadow-md flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Buat Memo Baru
              </button>
            </div>
          </div>

          {/* List Table of Memos */}
          <div className="bg-white rounded-[40px] border border-natural-border shadow-sm overflow-hidden">
            <div className="px-8 py-5 bg-natural-bg/30 border-b border-natural-border/60 flex items-center justify-between">
              <p className="text-[10px] uppercase font-bold text-natural-secondary tracking-widest">
                Riwayat Memo Pencairan Dana ({filteredMemos.length})
              </p>
            </div>

            {loading ? (
              <div className="p-16 text-center text-natural-secondary italic text-xs">Memuat data memo budget...</div>
            ) : filteredMemos.length === 0 ? (
              <div className="p-16 text-center text-natural-secondary italic text-xs space-y-3">
                <p>
                  {selectedMonthFilter !== 'ALL' || selectedYearFilter !== 'ALL' || searchTerm
                    ? 'Tidak ada Memo Budget Mingguan untuk filter yang dipilih.'
                    : 'Belum ada riwayat Memo Budget Mingguan yang dibuat.'}
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
                    <Plus className="w-4 h-4" /> Buat Memo Baru
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-natural-border/40">
                {filteredMemos.map(memo => (
                  <div key={memo.id} className="p-6 hover:bg-natural-bg/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          {memo.week} BULAN {memo.month} {memo.year}
                        </span>
                        {memo.isPosted && (
                          <span className="px-2.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-blue-600" /> Terposting
                          </span>
                        )}
                        <span className="text-xs text-natural-secondary font-medium">
                          {memo.memoCity}, {memo.memoDate}
                        </span>
                      </div>

                      <div className="text-sm font-bold text-natural-primary font-serif italic">
                        Pindah Buku Total: <span className="font-mono text-emerald-700">Rp. {formatRupiah(memo.transferAmount)},-</span>
                      </div>

                      <div className="text-[11px] text-natural-secondary flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>Jumlah Item: <strong>{(memo.items || []).length} kegiatan</strong></span>
                        <span>• Saldo Operasional: <strong className="font-mono">Rp. {formatRupiah(memo.operationalBalance)}</strong></span>
                        <span>• Total Saldo Setelahnya: <strong className="font-mono">Rp. {formatRupiah(memo.totalBalanceAfter)}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {memo.isPosted ? (
                        <div className="flex items-center gap-1">
                          <span 
                            className="px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-1.5"
                            title="Sudah diposting ke Buku Kas"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Diposting
                          </span>
                          <button
                            onClick={() => handleUnpostFromBukuKas(memo)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            title="Batalkan Posting dari Buku Kas"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePostToBukuKas(memo)}
                          className="px-4 py-2.5 bg-blue-700 text-white rounded-2xl text-xs font-bold hover:bg-blue-800 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                          title="Posting ke Buku Kas sebagai Penerimaan Pindah Buku"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Posting
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenPrint(memo)}
                        className="px-4 py-2.5 bg-emerald-800 text-white rounded-2xl text-xs font-bold hover:bg-emerald-900 transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                        title="Cetak A4"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Cetak PDF
                      </button>

                      <button
                        onClick={() => handleOpenEdit(memo)}
                        className="p-2.5 text-natural-primary bg-natural-bg hover:bg-natural-border/60 rounded-2xl transition-all cursor-pointer border border-natural-border"
                        title="Edit Memo"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => memo.id && handleDeleteMemo(memo.id, `${memo.week} ${memo.month}`)}
                        className="p-2.5 text-red-500 bg-red-50 hover:bg-red-100 rounded-2xl transition-all cursor-pointer border border-red-200"
                        title="Hapus Memo"
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

      {/* Mode Create or Edit Form */}
      {(mode === 'create' || mode === 'edit') && (
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="bg-white p-8 sm:p-10 rounded-[40px] border border-natural-border shadow-sm space-y-8">
            <div className="flex items-center justify-between pb-6 border-b border-natural-border/60">
              <div>
                <h3 className="text-2xl font-serif italic text-natural-primary">
                  {mode === 'create' ? 'Buat Memo Budget Mingguan Baru' : 'Edit Memo Budget Mingguan'}
                </h3>
                <p className="text-xs text-natural-secondary mt-0.5">
                  Isi rincian pengeluaran, saldo operasional, dan pejabat penandatangan memo
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

            <form onSubmit={handleSaveMemo} className="space-y-8 text-xs">
              {/* Section 1: Periode & Kop */}
              <div className="space-y-4 p-6 bg-natural-bg/30 border border-natural-border rounded-3xl">
                <h4 className="font-bold text-natural-primary text-xs uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  1. Periode Pencairan Dana & Rekening
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-natural-secondary mb-1">Minggu Ke-</label>
                    <select
                      className="w-full p-3 bg-white border border-natural-border rounded-xl font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary"
                      value={week}
                      onChange={e => setWeek(e.target.value)}
                    >
                      <option value="MINGGU 1">MINGGU 1</option>
                      <option value="MINGGU 2">MINGGU 2</option>
                      <option value="MINGGU 3">MINGGU 3</option>
                      <option value="MINGGU 4">MINGGU 4</option>
                      <option value="MINGGU 5">MINGGU 5</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-natural-secondary mb-1">Bulan</label>
                    <select
                      className="w-full p-3 bg-white border border-natural-border rounded-xl font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary"
                      value={month}
                      onChange={e => setMonth(e.target.value)}
                    >
                      {[
                        'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
                        'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
                      ].map(m => (
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block font-bold text-natural-secondary mb-1 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-natural-primary" /> Nama Rekening Operasional:
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full p-3 bg-white border border-natural-border rounded-xl font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary"
                      value={operationalAccountName}
                      onChange={e => setOperationalAccountName(e.target.value)}
                      placeholder="e.g. BANK BTM KOMITE (5.02.00097)"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-natural-secondary mb-1 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-natural-primary" /> Nama Rekening Pemasukan (Pindah Buku):
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full p-3 bg-white border border-natural-border rounded-xl font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary"
                      value={transferAccountName}
                      onChange={e => setTransferAccountName(e.target.value)}
                      placeholder="e.g. PEMASUKAN (5.02.00716)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-natural-secondary flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Saldo Operasional Awal (Rp):
                      </label>
                      
                      {mode === 'create' ? (
                        <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <Wallet className="w-3 h-3" /> Saldo Kas Terkini
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const latest = calculateCurrentBkkEndingBalance();
                            setOperationalBalance(latest);
                            safeAlert(`Saldo Operasional diperbarui ke Saldo Kas Terkini: Rp ${formatRupiah(latest)}`);
                          }}
                          className="text-[10px] text-emerald-700 hover:text-emerald-900 underline font-bold flex items-center gap-1 cursor-pointer"
                          title="Ambil saldo akhir buku kas saat ini"
                        >
                          <Wallet className="w-3 h-3" /> Sync Saldo Kas Saat Ini
                        </button>
                      )}
                    </div>
                    
                    <input
                      type="number"
                      required
                      className="w-full p-3 bg-white border border-natural-border rounded-xl font-mono font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary"
                      value={operationalBalance}
                      onChange={e => setOperationalBalance(Number(e.target.value))}
                    />
                    
                    <p className="text-[10px] text-natural-secondary mt-1">
                      {mode === 'create' 
                        ? 'Otomatis diambil dari saldo akhir buku kas saat ini.' 
                        : 'Nilai ini tersimpan dari saat memo dibuat dan tidak berubah otomatis.'}
                    </p>
                  </div>

                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col justify-center space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Ringkasan Otomatis:</span>
                    <div className="flex justify-between items-center text-xs">
                      <span>Pindah Buku Total:</span>
                      <strong className="font-mono text-emerald-900">Rp. {formatRupiah(totalTransferAmount)}</strong>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-emerald-200">
                      <span>Total Saldo Setelahnya:</span>
                      <strong className="font-mono text-emerald-900">Rp. {formatRupiah(totalBalanceAfter)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Pilih Anggaran & Custom Items */}
              <div className="space-y-4 p-6 bg-natural-bg/30 border border-natural-border rounded-3xl">
                <h4 className="font-bold text-natural-primary text-xs uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  2. Rincian Pengeluaran (Tabel Anggaran)
                </h4>

                {/* Option A: Pick from Approved Budget Reports */}
                <div className="p-4 bg-white border border-natural-border rounded-2xl space-y-2">
                  <label className="block font-bold text-natural-primary text-[11px]">
                    Option A: Pilih dari Anggaran Disetujui (Rencana Anggaran Belanja)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      className="flex-1 p-3 bg-natural-bg/40 border border-natural-border rounded-xl text-xs font-bold text-natural-primary focus:outline-hidden focus:border-natural-primary"
                      value={selectedReportId}
                      onChange={e => setSelectedReportId(e.target.value)}
                    >
                      <option value="">-- Pilih Anggaran Kegiatan Disetujui --</option>
                      {approvedReports.map(r => (
                        <option key={r.id} value={r.id}>
                          [{r.unitName}] {r.activityName} - Rp. {formatRupiah(r.amountReceived || r.totalSpent || 0)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddApprovedReportItem}
                      disabled={!selectedReportId}
                      className="px-5 py-3 bg-natural-primary text-white font-bold rounded-xl hover:bg-natural-primary/90 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
                    >
                      + Tambah ke Tabel
                    </button>
                  </div>
                </div>

                {/* Option B: Add Custom Manual Item */}
                <div className="p-4 bg-white border border-natural-border rounded-2xl space-y-2">
                  <label className="block font-bold text-natural-primary text-[11px]">
                    Option B: Tambah Pengeluaran Manual (Di Luar Anggaran)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Nama Kegiatan (e.g. Fun Game AUM)"
                      className="sm:col-span-2 p-3 bg-natural-bg/40 border border-natural-border rounded-xl text-xs font-bold text-natural-primary"
                      value={customActivity}
                      onChange={e => setCustomActivity(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Nominal (Rp)"
                        className="flex-1 p-3 bg-natural-bg/40 border border-natural-border rounded-xl text-xs font-mono font-bold text-natural-primary"
                        value={customAmount}
                        onChange={e => setCustomAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomItem}
                        className="px-4 py-3 bg-emerald-700 text-white font-bold rounded-xl hover:bg-emerald-800 transition-all cursor-pointer whitespace-nowrap"
                      >
                        + Tambah
                      </button>
                    </div>
                  </div>
                </div>

                {/* Table of Items */}
                <div className="bg-white border border-natural-border rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-natural-bg/60 border-b border-natural-border text-[10px] font-bold text-natural-secondary uppercase tracking-wider">
                        <th className="p-3">No</th>
                        <th className="p-3">Uraian / Nama Kegiatan Pengeluaran</th>
                        <th className="p-3 text-right">Nominal (Rp)</th>
                        <th className="p-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-natural-border/40 text-xs">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-natural-secondary italic">
                            Belum ada pengeluaran ditambahkan. Harap pilih dari anggaran disetujui atau isi opsi manual.
                          </td>
                        </tr>
                      ) : (
                        items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-natural-bg/30">
                            <td className="p-3 font-mono text-natural-secondary">{idx + 1}</td>
                            <td className="p-3 font-bold text-natural-primary">
                              {item.activityName}
                              {item.isCustom && (
                                <span className="ml-2 text-[9px] px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-sans font-normal">
                                  Di luar anggaran
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <input
                                type="number"
                                className="w-36 p-1.5 bg-natural-bg/30 border border-natural-border rounded-lg text-right font-mono font-bold text-natural-primary focus:bg-white"
                                value={item.amount}
                                onChange={e => handleUpdateItemAmount(idx, Number(e.target.value))}
                              />
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                title="Hapus Item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                      {items.length > 0 && (
                        <tr className="bg-emerald-50/50 font-bold border-t-2 border-natural-border">
                          <td colSpan={2} className="p-3 text-emerald-900 uppercase">TOTAL PINDAH BUKU</td>
                          <td className="p-3 text-right font-mono text-emerald-900 text-sm">
                            Rp. {formatRupiah(totalTransferAmount)},-
                          </td>
                          <td></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 3: Tanggal & Penandatangan */}
              <div className="space-y-4 p-6 bg-natural-bg/30 border border-natural-border rounded-3xl">
                <h4 className="font-bold text-natural-primary text-xs uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  3. Tanggal, Kota & Pejabat Penandatangan Memo
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-natural-secondary mb-1">Kota Pembuatan Memo:</label>
                    <input
                      type="text"
                      className="w-full p-3 bg-white border border-natural-border rounded-xl font-bold text-natural-primary"
                      value={memoCity}
                      onChange={e => setMemoCity(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-natural-secondary mb-1">Tanggal Memo (e.g. 14 September 2026):</label>
                    <input
                      type="text"
                      className="w-full p-3 bg-white border border-natural-border rounded-xl font-bold text-natural-primary"
                      value={memoDate}
                      onChange={e => setMemoDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {/* Penandatangan 1 */}
                  <div className="p-4 bg-white border border-natural-border rounded-2xl space-y-3">
                    <span className="block font-bold text-emerald-800 text-[10px] uppercase border-b pb-1">
                      Kolom 1: Disetujui Oleh
                    </span>
                    <div>
                      <label className="block text-[10px] text-natural-secondary font-bold">Nama Lengkap:</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-natural-bg/40 border border-natural-border rounded-lg font-bold text-natural-primary"
                        value={approverName}
                        onChange={e => setApproverName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-natural-secondary font-bold">Nomor NBM:</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-natural-bg/40 border border-natural-border rounded-lg font-mono font-bold text-natural-primary"
                        value={approverNbm}
                        onChange={e => setApproverNbm(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Penandatangan 2 */}
                  <div className="p-4 bg-white border border-natural-border rounded-2xl space-y-3">
                    <span className="block font-bold text-emerald-800 text-[10px] uppercase border-b pb-1">
                      Kolom 2: Diperiksa Oleh
                    </span>
                    <div>
                      <label className="block text-[10px] text-natural-secondary font-bold">Nama Lengkap:</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-natural-bg/40 border border-natural-border rounded-lg font-bold text-natural-primary"
                        value={checkerName}
                        onChange={e => setCheckerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-natural-secondary font-bold">Nomor NBM:</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-natural-bg/40 border border-natural-border rounded-lg font-mono font-bold text-natural-primary"
                        value={checkerNbm}
                        onChange={e => setCheckerNbm(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Penandatangan 3 */}
                  <div className="p-4 bg-white border border-natural-border rounded-2xl space-y-3">
                    <span className="block font-bold text-emerald-800 text-[10px] uppercase border-b pb-1">
                      Kolom 3: Dibuat Oleh
                    </span>
                    <div>
                      <label className="block text-[10px] text-natural-secondary font-bold">Nama Lengkap:</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-natural-bg/40 border border-natural-border rounded-lg font-bold text-natural-primary"
                        value={makerName}
                        onChange={e => setMakerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-natural-secondary font-bold">Nomor NBM:</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-natural-bg/40 border border-natural-border rounded-lg font-mono font-bold text-natural-primary"
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
                  Simpan Memo Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
