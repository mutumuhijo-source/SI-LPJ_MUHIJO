import React, { useState, useMemo, useEffect } from 'react';
import { 
  BookOpen, 
  Printer, 
  RotateCw, 
  Calendar, 
  Receipt, 
  Eye, 
  Plus, 
  Edit2, 
  Trash2, 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  X, 
  Info,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  serverTimestamp,
  query,
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Report, Unit, ExpenseType, ReportStatus, DirectCashOutflow, CashInflow, BkkSettings } from '../types';
import { formatCurrency, formatDate, terbilang, safeAlert, safeConfirm, parseAmount } from '../lib/utils';

interface BukuKasKeluarProps {
  reports: Report[];
  units: Unit[];
  expenseTypes: ExpenseType[];
  onSelectReport?: (report: Report) => void;
  onRefresh?: () => void;
  loading?: boolean;
}

export type JournalItemType = 
  | 'inflow_pindah_buku' 
  | 'lpj_detail' 
  | 'lpj_allocation' 
  | 'lpj_remaining' 
  | 'lpj_deficit' 
  | 'direct_outflow';

export interface UnifiedJournalItem {
  id: string;
  itemType: JournalItemType;
  reportId?: string;
  directId?: string;
  inflowId?: string;
  activityName: string;
  unitName: string;
  date: string;
  approvalDate?: string;
  instructionDate?: string;
  groupDate?: string;
  inputTimestamp?: number;
  inputOrder?: number;
  noBukti: string;
  category: string;
  description: string;
  partyName: string; // Penerima atau Sumber Asal Rekening
  inflowAmount: number; // Penerimaan (Rp)
  outflowAmount: number; // Pengeluaran (Rp)
  runningBalance?: number;
  status?: ReportStatus;
  notes?: string;
  report?: Report;
  directData?: DirectCashOutflow;
  inflowData?: CashInflow;
  detailOrder: number; // To ensure Sisa Anggaran is at the bottom of realization items
}

const MONTH_OPTIONS = [
  { value: '1', label: 'Januari' },
  { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' },
  { value: '4', label: 'April' },
  { value: '5', label: 'Mei' },
  { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' },
  { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
];

export const BukuKasKeluar: React.FC<BukuKasKeluarProps> = ({
  reports,
  units,
  expenseTypes,
  onSelectReport,
  onRefresh,
  loading = false,
}) => {
  // --- BKK Settings (Saldo Awal) State ---
  const [bkkSettings, setBkkSettings] = useState<BkkSettings>(() => {
    const cached = localStorage.getItem('bkk_settings_cache');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // ignore
      }
    }
    return {
      initialBalance: 0,
      initialBalanceDate: '2026-09-01',
      notes: 'Saldo Kas per 1 September 2026',
    };
  });

  // Direct Cash Outflows (Non-LPJ) & Cash Inflows (Pindah Buku)
  const [directOutflows, setDirectOutflows] = useState<DirectCashOutflow[]>([]);
  const [cashInflows, setCashInflows] = useState<CashInflow[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Modals state
  const [showSaldoModal, setShowSaldoModal] = useState(false);
  const [saldoInput, setSaldoInput] = useState(bkkSettings.initialBalance.toString());
  const [saldoDateInput, setSaldoDateInput] = useState(bkkSettings.initialBalanceDate || '2026-09-01');
  const [saldoNotesInput, setSaldoNotesInput] = useState(bkkSettings.notes || 'Saldo Kas per 1 September 2026');
  const [savingSaldo, setSavingSaldo] = useState(false);

  // Pindah Buku Modal (Penerimaan Kas)
  const [showPindahBukuModal, setShowPindahBukuModal] = useState(false);
  const [editingInflow, setEditingInflow] = useState<CashInflow | null>(null);
  const [pindahBukuForm, setPindahBukuForm] = useState({
    date: new Date().toISOString().split('T')[0],
    noBukti: '',
    sourceAccount: 'Bank Jateng',
    category: 'Pindah Buku Rekening Bank',
    description: '',
    amount: '',
    receivedFrom: 'Bendahara Sekolah',
    notes: '',
  });
  const [savingPindahBuku, setSavingPindahBuku] = useState(false);

  // Direct Cash Outflow Modal
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [editingDirect, setEditingDirect] = useState<DirectCashOutflow | null>(null);
  const [directForm, setDirectForm] = useState({
    date: new Date().toISOString().split('T')[0],
    noBukti: '',
    unitName: 'Umum / Bendahara',
    category: 'Operasional Kas Sekolah',
    description: '',
    amount: '',
    employeeName: '',
    notes: '',
  });
  const [savingDirect, setSavingDirect] = useState(false);

  // Filter States: Defaultnya adalah bulan berjalan saat ini
  const currentDate = new Date();
  const defaultCurrentMonth = (currentDate.getMonth() + 1).toString();
  const defaultCurrentYear = currentDate.getFullYear().toString();

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultCurrentMonth);
  const [selectedYear, setSelectedYear] = useState<string>(defaultCurrentYear);

  // Active Tab: purely focused on Buku Kas and quick access to manage Pindah Buku / Non-LPJ
  const [activeTab, setActiveTab] = useState<'journal' | 'pindah_buku_list' | 'direct_list'>('journal');

  // Listen to BKK Settings from Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'bkk_settings', 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as BkkSettings;
        setBkkSettings(data);
        setSaldoInput((data.initialBalance || 0).toString());
        setSaldoDateInput(data.initialBalanceDate || '2026-09-01');
        setSaldoNotesInput(data.notes || '');
        localStorage.setItem('bkk_settings_cache', JSON.stringify(data));
      }
    }, (err) => {
      console.warn("BKK settings listener error:", err);
    });

    return () => unsub();
  }, []);

  // Listen to Direct Cash Outflows from Firestore
  useEffect(() => {
    setLoadingTransactions(true);
    const q = query(collection(db, 'direct_cash_outflows'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as DirectCashOutflow));
      setDirectOutflows(list);
      setLoadingTransactions(false);
    }, (err) => {
      console.warn("Direct outflows listener error:", err);
      setLoadingTransactions(false);
    });

    return () => unsub();
  }, []);

  // Listen to Cash Inflows (Pindah Buku) from Firestore
  useEffect(() => {
    const q = query(collection(db, 'cash_inflows'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as CashInflow));
      setCashInflows(list);
    }, (err) => {
      console.warn("Cash inflows listener error:", err);
    });

    return () => unsub();
  }, []);

  // Helper to extract the date when budget was instructed to become a report (bukan tanggal disetujui awal anggaran)
  const getReportingInstructionDate = (r: Report): string => {
    // 1. Tanggal eksplisit saat anggaran diinstruksikan menjadi laporan / pengisian laporan
    if (r.reportingInstructedDate) return r.reportingInstructedDate;
    if (r.reportingInstructedAt && typeof r.reportingInstructedAt.toDate === 'function') {
      return r.reportingInstructedAt.toDate().toISOString().split('T')[0];
    }
    // 2. Tanggal transaksi rincian realisasi pertama (jika ada input transaksi)
    if (r.details && r.details.length > 0) {
      const detailDates = r.details.map(d => d.date).filter(Boolean).sort();
      if (detailDates.length > 0 && detailDates[0]) {
        return detailDates[0];
      }
    }
    // 3. Tanggal laporan disahkan / selesai
    if (r.completedDate) return r.completedDate;
    if (r.completedAt && typeof r.completedAt.toDate === 'function') {
      return r.completedAt.toDate().toISOString().split('T')[0];
    }
    // 4. Tanggal update status laporan
    if (r.updatedAt && typeof r.updatedAt.toDate === 'function') {
      return r.updatedAt.toDate().toISOString().split('T')[0];
    }
    // 5. Fallback ke submissionDate atau tanggal saldo awal
    if (r.submissionDate) return r.submissionDate;
    return bkkSettings.initialBalanceDate || '2026-09-01';
  };

  // Helper untuk mem-parse tanggal dalam berbagai format (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, dsb)
  const parseTransactionDate = (dateStr?: string | null): { year: number; month: number; day: number; iso: string } | null => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const clean = dateStr.trim().split('T')[0];
    if (!clean) return null;

    // 1. Format YYYY-MM-DD atau YYYY/MM/DD
    const ymd = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (ymd) {
      const year = parseInt(ymd[1], 10);
      const month = parseInt(ymd[2], 10);
      const day = parseInt(ymd[3], 10);
      const iso = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      return { year, month, day, iso };
    }

    // 2. Format DD-MM-YYYY atau DD/MM/YYYY
    const dmy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmy) {
      const year = parseInt(dmy[3], 10);
      const month = parseInt(dmy[2], 10);
      const day = parseInt(dmy[1], 10);
      const iso = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      return { year, month, day, iso };
    }

    // 3. Fallback: JavaScript Date parser
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = parsed.getMonth() + 1;
      const day = parsed.getDate();
      const iso = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      return { year, month, day, iso };
    }

    return null;
  };

  // Cek apakah suatu tanggal transaksi berada sebelum tanggal dimulainya Buku Kas (berdasarkan initialBalanceDate)
  const isDateBeforeBukuKasStart = (dateStr?: string | null): boolean => {
    if (!dateStr) return false;
    const parsed = parseTransactionDate(dateStr);
    if (!parsed) return false;

    const initialDateStr = bkkSettings.initialBalanceDate || '2026-09-01';
    const parsedInit = parseTransactionDate(initialDateStr);

    if (parsedInit) {
      // 1. Jika tanggal transaksi secara ISO mendahului tanggal saldo awal
      if (parsed.iso < parsedInit.iso) return true;

      // 2. Proteksi tahun ajaran / input (jika tanggal saldo awal diatur September 2026 atau 2025):
      // Abaikan semua transaksi sebelum bulan September (misal Juni, Juli, Agustus)
      if (parsedInit.month === 9) {
        if (parsed.year < parsedInit.year) return true;
        if (parsed.year === parsedInit.year && parsed.month < 9) return true;
        // Penjagaan jika data berstempel 2026 tetapi setting sempat tertulis 2025:
        if (parsedInit.year === 2025 && parsed.year === 2026 && parsed.month < 9) return true;
      }
    } else {
      if (parsed.iso < '2026-09-01') return true;
    }

    return false;
  };

  // Helper untuk mendapatkan nilai timestamp numerik untuk menjaga urutan input secara stabil
  const getEntryTimestamp = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    if (val.seconds) return val.seconds * 1000 + (val.nanoseconds ? Math.floor(val.nanoseconds / 1000000) : 0);
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };

  // Build the complete combined journal with Penerimaan, Pengeluaran, and Sisa Anggaran at bottom
  // Catatan: Buku Kas tetap dimulai per tanggal saldo awal yang dikonfigurasi (September)
  const allJournalItems = useMemo<UnifiedJournalItem[]>(() => {
    const items: UnifiedJournalItem[] = [];

    // 1. Process Pindah Buku (Penerimaan Kas)
    cashInflows.forEach((inflow, idx) => {
      const itemDate = inflow.date || bkkSettings.initialBalanceDate || '2026-09-01';
      if (isDateBeforeBukuKasStart(itemDate)) return; // Lewati transaksi sebelum Buku Kas

      const ts = getEntryTimestamp(inflow.createdAt) || (parseTransactionDate(itemDate) ? new Date(parseTransactionDate(itemDate)!.iso).getTime() : 0);

      items.push({
        id: `inflow-${inflow.id || idx}`,
        itemType: 'inflow_pindah_buku',
        inflowId: inflow.id,
        activityName: 'Penerimaan Kas (Pindah Buku)',
        unitName: 'Kas Utama Bendahara',
        date: itemDate,
        approvalDate: itemDate,
        instructionDate: itemDate,
        groupDate: itemDate,
        inputTimestamp: ts,
        inputOrder: idx,
        noBukti: inflow.noBukti?.trim() || `BKM/PB-${(idx + 1).toString().padStart(3, '0')}`,
        category: inflow.category || 'Pindah Buku Bank',
        description: inflow.description || 'Penerimaan dana kas sekolah',
        partyName: inflow.sourceAccount || inflow.receivedFrom || 'Bank',
        inflowAmount: Number(inflow.amount) || 0,
        outflowAmount: 0,
        notes: inflow.notes,
        inflowData: inflow,
        detailOrder: 0,
      });
    });

    // 2. Process LPJ Reports according to workflow:
    // Rule 1: Anggaran yang belum diinstruksikan pengisian / masih di menu anggaran (walau disetujui) TIDAK dimasukkan ke Buku Kas.
    // Rule 2: Jika sudah diinstruksikan untuk pengisian / pindah ke menu laporan, baru masuk ke Buku Kas dengan muncul anggaran totalnya.
    // Rule 3: Jika bendahara/admin sudah menyetujui laporan (COMPLETED/ARCHIVED), baru rincian realisasi keluar beserta sisanya.
    // Rule 4: Jika realisasi lebih besar dari anggaran disetujui, munculkan kekurangan anggaran di bagian PENERIMAAN (Rp).
    // Rule 5: Seluruh transaksi sebelum tanggal saldo awal tidak boleh dimasukkan ke Buku Kas.
    reports.forEach((r, rIdx) => {
      // Cek apakah masih berada di menu usulan / persetujuan anggaran
      const isInBudgetMenu = 
        r.status === ReportStatus.BUDGET_PROPOSAL ||
        r.status === ReportStatus.BUDGET_APPROVED ||
        r.status === ReportStatus.REJECTED ||
        (r.status === ReportStatus.REVISION && (!r.details || r.details.length === 0));

      if (isInBudgetMenu) {
        // Jangan masukkan ke Buku Kas jika masih di menu anggaran
        return;
      }

      const instructDate = getReportingInstructionDate(r);
      const reportTs = getEntryTimestamp(r.reportingInstructedAt || r.submittedAt || r.approvedAt || r.updatedAt) || (parseTransactionDate(instructDate) ? new Date(parseTransactionDate(instructDate)!.iso).getTime() : 0);

      // Cek apakah laporan telah disetujui oleh bendahara / admin
      const isReportApproved = r.status === ReportStatus.COMPLETED || r.status === ReportStatus.ARCHIVED;

      if (isReportApproved) {
        const hasDetails = r.details && r.details.length > 0;

        if (hasDetails) {
          // Filter rincian yang berada di dalam periode Buku Kas (>= 1 September)
          const validDetails = (r.details || []).filter(d => !isDateBeforeBukuKasStart(d.date || instructDate));

          // Jika SELURUH rincian transaksi laporan ini berada sebelum periode Buku Kas,
          // lewati laporan ini sepenuhnya agar riwayat lama tidak mengotori Buku Kas & saldo real!
          if (validDetails.length === 0) {
            return;
          }

          let sumSpent = 0;
          // Rincian realisasi pengeluaran: wajib pertahankan urutan input (0, 1, 2, ...)
          validDetails.forEach((d, idx) => {
            const detailDate = d.date || instructDate;
            const budgetItem = r.proposedDetails && d.proposedIndex !== undefined 
              ? r.proposedDetails[d.proposedIndex] 
              : null;
            const category = d.category || budgetItem?.category || 'Belanja Kegiatan';
            const amt = Number(d.amount) || 0;
            sumSpent += amt;

            items.push({
              id: `lpj-det-${r.id || 'r'}-${idx}`,
              itemType: 'lpj_detail',
              reportId: r.id,
              activityName: r.activityName || 'Kegiatan',
              unitName: r.unitName || 'Umum',
              date: detailDate,
              instructionDate: instructDate,
              approvalDate: instructDate,
              groupDate: instructDate,
              inputTimestamp: reportTs,
              inputOrder: rIdx,
              noBukti: d.noBukti?.trim() || `BKK/LPJ-${(idx + 1).toString().padStart(3, '0')}`,
              category: category,
              description: d.description || 'Realisasi anggaran belanja',
              partyName: d.employeeName || r.unitName,
              inflowAmount: 0,
              outflowAmount: amt,
              status: r.status,
              report: r,
              detailOrder: 10 + idx, // Selalu berurutan sesuai input (detailOrder)
            });
          });

          // Tanggal untuk sisa atau kekurangan: gunakan tanggal selesai laporan atau rincian terakhir atau instructDate
          const latestDetailDate = (validDetails.length > 0 && validDetails[validDetails.length - 1].date) 
            ? validDetails[validDetails.length - 1].date 
            : '';
          const closingDate = r.completedDate || latestDetailDate || instructDate;

          // Hanya masukkan sisa/kekurangan jika tanggal tidak sebelum tanggal Buku Kas
          if (!isDateBeforeBukuKasStart(closingDate)) {
            const budgetAmount = Number(r.amountReceived) || 0;
            const totalReportSpent = (r.details || []).reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
            const diff = Math.round((budgetAmount - totalReportSpent) * 10000) / 10000;

            if (diff > 0) {
              // Sisa Anggaran (realisasi < anggaran) dimunculkan di urutan paling bawah rincian realisasi
              items.push({
                id: `lpj-rem-${r.id || 'r'}`,
                itemType: 'lpj_remaining',
                reportId: r.id,
                activityName: r.activityName || 'Kegiatan',
                unitName: r.unitName || 'Umum',
                date: closingDate,
                instructionDate: instructDate,
                approvalDate: instructDate,
                groupDate: instructDate,
                inputTimestamp: reportTs,
                inputOrder: rIdx,
                noBukti: `BKK/SA-${(r.id || '000').substring(0, 5).toUpperCase()}`,
                category: 'Sisa Anggaran',
                description: `Sisa Anggaran: ${r.activityName} (${r.unitName})`,
                partyName: `Unit ${r.unitName}`,
                inflowAmount: 0,
                outflowAmount: diff,
                status: r.status,
                notes: 'Sisa anggaran yang dicatatkan di urutan paling bawah rincian realisasi',
                report: r,
                detailOrder: 999999, // Di urutan paling bawah
              });
            } else if (diff < 0) {
              // Realisasi LEBIH BESAR dari anggaran: munculkan kekurangan anggaran di PENERIMAAN
              const deficit = Math.abs(diff);
              items.push({
                id: `lpj-def-${r.id || 'r'}`,
                itemType: 'lpj_deficit',
                reportId: r.id,
                activityName: r.activityName || 'Kegiatan',
                unitName: r.unitName || 'Umum',
                date: closingDate,
                instructionDate: instructDate,
                approvalDate: instructDate,
                groupDate: instructDate,
                inputTimestamp: reportTs,
                inputOrder: rIdx,
                noBukti: `BKK/KUR-${(r.id || '000').substring(0, 5).toUpperCase()}`,
                category: 'Kekurangan Anggaran',
                description: `Kekurangan Anggaran: ${r.activityName} (${r.unitName})`,
                partyName: `Unit ${r.unitName} / Kas Bendahara`,
                inflowAmount: deficit, // MASUK DI BAGIAN PENERIMAAN (Rp)!
                outflowAmount: 0,
                status: r.status,
                notes: 'Kekurangan realisasi dimasukkan di penerimaan untuk pengembalian/talangan oleh bendahara',
                report: r,
                detailOrder: 999999, // Di urutan paling bawah
              });
            }
          }
        } else {
          // Laporan disetujui tanpa item rincian: masukkan total anggaran jika tanggal >= start
          if (!isDateBeforeBukuKasStart(instructDate)) {
            const amt = Number(r.amountReceived) || 0;
            if (amt > 0) {
              items.push({
                id: `lpj-alloc-${r.id || 'r'}`,
                itemType: 'lpj_allocation',
                reportId: r.id,
                activityName: r.activityName || 'Kegiatan',
                unitName: r.unitName || 'Umum',
                date: instructDate,
                instructionDate: instructDate,
                approvalDate: instructDate,
                groupDate: instructDate,
                inputTimestamp: reportTs,
                inputOrder: rIdx,
                noBukti: `BKK/ANG-${(r.id || '000').substring(0, 5).toUpperCase()}`,
                category: 'Pencairan Anggaran LPJ',
                description: `Anggaran Disetujui: ${r.activityName} (${r.unitName})`,
                partyName: `Unit ${r.unitName}`,
                inflowAmount: 0,
                outflowAmount: amt,
                status: r.status,
                notes: 'Laporan telah disetujui',
                report: r,
                detailOrder: 5,
              });
            }
          }
        }
      } else {
        // Status sudah diinstruksikan untuk pengisian / pindah ke menu laporan (REPORTING, INCOMPLETE, REVISION dg rincian)
        // Belum disetujui admin/bendahara: tampilkan total anggarannya di Buku Kas jika tanggal >= start
        if (!isDateBeforeBukuKasStart(instructDate)) {
          const amt = Number(r.amountReceived) || 0;
          if (amt > 0) {
            items.push({
              id: `lpj-alloc-${r.id || 'r'}`,
              itemType: 'lpj_allocation',
              reportId: r.id,
              activityName: r.activityName || 'Kegiatan',
              unitName: r.unitName || 'Umum',
              date: instructDate,
              instructionDate: instructDate,
              approvalDate: instructDate,
              groupDate: instructDate,
              inputTimestamp: reportTs,
              inputOrder: rIdx,
              noBukti: `BKK/ANG-${(r.id || '000').substring(0, 5).toUpperCase()}`,
              category: 'Pencairan Anggaran LPJ',
              description: `Alokasi Anggaran: ${r.activityName} (${r.unitName}) - Diinstruksikan Pengisian Laporan`,
              partyName: `Unit ${r.unitName}`,
              inflowAmount: 0,
              outflowAmount: amt,
              status: r.status,
              notes: 'Diinstruksikan untuk pengisian laporan realisasi',
              report: r,
              detailOrder: 5,
            });
          }
        }
      }
    });

    // 3. Process Direct Cash Outflows (Non-LPJ)
    directOutflows.forEach((item, idx) => {
      const itemDate = item.date || bkkSettings.initialBalanceDate || '2026-09-01';
      if (isDateBeforeBukuKasStart(itemDate)) return; // Lewati transaksi sebelum Buku Kas

      const ts = getEntryTimestamp(item.createdAt) || (parseTransactionDate(itemDate) ? new Date(parseTransactionDate(itemDate)!.iso).getTime() : 0);

      items.push({
        id: `direct-${item.id || idx}`,
        itemType: 'direct_outflow',
        directId: item.id,
        activityName: 'Pengeluaran Langsung Kas Sekolah (Non-LPJ)',
        unitName: item.unitName || 'Umum / Bendahara',
        date: itemDate,
        approvalDate: itemDate,
        instructionDate: itemDate,
        groupDate: itemDate,
        inputTimestamp: ts,
        inputOrder: idx,
        noBukti: item.noBukti?.trim() || `BKK/DIR-${(idx + 1).toString().padStart(3, '0')}`,
        category: item.category || 'Operasional Kas Sekolah',
        description: item.description,
        partyName: item.employeeName || '-',
        inflowAmount: 0,
        outflowAmount: Number(item.amount) || 0,
        notes: item.notes,
        directData: item,
        detailOrder: 0,
      });
    });

    return items;
  }, [reports, directOutflows, cashInflows, bkkSettings.initialBalanceDate]);

  // Available years detected from data + current year
  const availableYears = useMemo(() => {
    const yearSet = new Set<string>();
    const currentYear = new Date().getFullYear().toString();
    yearSet.add(currentYear);
    yearSet.add('2026');
    yearSet.add('2025');

    allJournalItems.forEach((item) => {
      const dateStr = item.date;
      if (dateStr && dateStr.length >= 4) {
        const y = dateStr.slice(0, 4);
        if (/^\d{4}$/.test(y)) {
          yearSet.add(y);
        }
      }
    });

    return Array.from(yearSet).sort((a, b) => b.localeCompare(a));
  }, [allJournalItems]);

  // Helper untuk mengecek apakah filter yang dipilih adalah periode sebelum dimulainya Buku Kas
  const isFilterBeforeBukuKasStart = useMemo(() => {
    const initialDateStr = bkkSettings.initialBalanceDate || '2026-09-01';
    const parsedInit = parseTransactionDate(initialDateStr);
    const startYear = parsedInit?.year ?? 2026;
    const startMonth = parsedInit?.month ?? 9;

    if (selectedYear !== 'ALL') {
      const y = parseInt(selectedYear, 10);
      if (y < startYear) return true;
      if (y === startYear && selectedMonth !== 'ALL' && parseInt(selectedMonth, 10) < startMonth) {
        return true;
      }
      // Penjagaan jika startYear 2025 tetapi tahun transaksi 2026 sebelum September:
      if (startYear === 2025 && y === 2026 && selectedMonth !== 'ALL' && parseInt(selectedMonth, 10) < 9) {
        return true;
      }
    }
    return false;
  }, [selectedMonth, selectedYear, bkkSettings.initialBalanceDate]);

  // Label tampilan tanggal saldo awal kas
  const initialDateDisplay = useMemo(() => {
    return formatDate(bkkSettings.initialBalanceDate || '2026-09-01', { dateStyle: 'medium' });
  }, [bkkSettings.initialBalanceDate]);

  // Apply Filter: Sisakan filter untuk bulan dan tahun saja (Buku kas tetap dari September)
  // Urutkan pada buku kas berdasarkan tanggal transaksi input atau saat anggaran diinstruksikan menjadi laporan
  // Serta pertahankan urutan input (input order) secara konsisten
  const filteredJournalItems = useMemo(() => {
    // Rule: "jika ada yang filter sebelum september dikosongkan saja transaksinya"
    if (isFilterBeforeBukuKasStart) {
      return [];
    }

    return allJournalItems
      .filter((item) => {
        const effectiveDate = item.groupDate || (item.reportId ? (item.instructionDate || item.date) : item.date);
        if (!effectiveDate) {
          return selectedMonth === 'ALL' && selectedYear === 'ALL';
        }

        // Buku kas tetap dari tanggal saldo awal (transaksi sebelum saldo awal diabaikan)
        if (isDateBeforeBukuKasStart(effectiveDate)) {
          return false;
        }

        const parsed = parseTransactionDate(effectiveDate);
        if (!parsed) return false;

        if (selectedYear !== 'ALL' && parsed.year.toString() !== selectedYear) {
          return false;
        }

        if (selectedMonth !== 'ALL' && parsed.month.toString() !== selectedMonth) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // 1. Jika berasal dari laporan kegiatan LPJ yang sama, WAJIB pertahankan urutan input rincian & sisa/kekurangan di urutan paling bawah
        if (a.reportId && b.reportId && a.reportId === b.reportId) {
          return a.detailOrder - b.detailOrder;
        }

        // 2. Tanggal pengurutan utama transaksi:
        // Berdasarkan tanggal transaksi input (date) atau saat anggaran diinstruksikan menjadi laporan (instructionDate)
        const primaryDateA = a.groupDate || (a.reportId ? (a.instructionDate || a.date) : a.date) || '';
        const primaryDateB = b.groupDate || (b.reportId ? (b.instructionDate || b.date) : b.date) || '';
        const cmpDate = primaryDateA.localeCompare(primaryDateB);
        if (cmpDate !== 0) return cmpDate;

        // 3. Jika tanggal sama dan berbeda laporan / transaksi:
        // Kelompokkan per laporan kegiatan agar rincian kegiatan tetap utuh berurutan
        const groupA = a.reportId ? `report-${a.reportId}` : `single-${a.id}`;
        const groupB = b.reportId ? `report-${b.reportId}` : `single-${b.id}`;
        if (groupA !== groupB) {
          // Tetap diurutkan berdasarkan urutan input (inputTimestamp / inputOrder)
          if (a.inputTimestamp && b.inputTimestamp && a.inputTimestamp !== b.inputTimestamp) {
            return a.inputTimestamp - b.inputTimestamp;
          }
          if (a.inputOrder !== undefined && b.inputOrder !== undefined && a.inputOrder !== b.inputOrder) {
            return a.inputOrder - b.inputOrder;
          }
          return groupA.localeCompare(groupB);
        }

        // 4. Urutan di dalam kelompok kegiatan: wajib berdasarkan urutan input
        return a.detailOrder - b.detailOrder;
      });
  }, [allJournalItems, selectedMonth, selectedYear, isFilterBeforeBukuKasStart, bkkSettings.initialBalanceDate]);

  // Aggregations: Total Periode Terfilter
  const totalInflow = useMemo(() => {
    const sum = filteredJournalItems.reduce((acc, item) => acc + item.inflowAmount, 0);
    return Math.round(sum * 10000) / 10000;
  }, [filteredJournalItems]);

  const totalOutflow = useMemo(() => {
    const sum = filteredJournalItems.reduce((acc, item) => acc + item.outflowAmount, 0);
    return Math.round(sum * 10000) / 10000;
  }, [filteredJournalItems]);

  // REAL TOTALS: "saldo akhir muncul bukan berdasarkan filter tetapi real saldo akhir saja"
  // Kumulatif seluruh transaksi kas valid sejak dimulainya Buku Kas
  const realTotalInflow = useMemo(() => {
    const sum = allJournalItems
      .filter((item) => !isDateBeforeBukuKasStart(item.groupDate || item.date))
      .reduce((acc, item) => acc + item.inflowAmount, 0);
    return Math.round(sum * 10000) / 10000;
  }, [allJournalItems, bkkSettings.initialBalanceDate]);

  const realTotalOutflow = useMemo(() => {
    const sum = allJournalItems
      .filter((item) => !isDateBeforeBukuKasStart(item.groupDate || item.date))
      .reduce((acc, item) => acc + item.outflowAmount, 0);
    return Math.round(sum * 10000) / 10000;
  }, [allJournalItems, bkkSettings.initialBalanceDate]);

  // Real Saldo Akhir Kas yang sesungguhnya (saldo kas riil kumulatif)
  const realFinalBalance = useMemo(() => {
    const init = bkkSettings.initialBalance || 0;
    return Math.round((init + realTotalInflow - realTotalOutflow) * 10000) / 10000;
  }, [bkkSettings.initialBalance, realTotalInflow, realTotalOutflow]);

  // Saldo Awal Pindahan sebelum periode yang difilter
  const priorBalance = useMemo(() => {
    let bal = bkkSettings.initialBalance || 0;
    if (selectedYear === 'ALL' && selectedMonth === 'ALL') {
      return bal;
    }
    allJournalItems.forEach((item) => {
      const effectiveDate = item.groupDate || (item.reportId ? (item.instructionDate || item.date) : item.date) || '';
      if (!effectiveDate || isDateBeforeBukuKasStart(effectiveDate)) return;
      const parsed = parseTransactionDate(effectiveDate);
      if (!parsed) return;
      const y = parsed.year;
      const m = parsed.month;

      if (selectedYear !== 'ALL') {
        const targetYear = parseInt(selectedYear, 10);
        if (y < targetYear) {
          bal += (item.inflowAmount - item.outflowAmount);
        } else if (y === targetYear && selectedMonth !== 'ALL') {
          const targetMonth = parseInt(selectedMonth, 10);
          if (m < targetMonth) {
            bal += (item.inflowAmount - item.outflowAmount);
          }
        }
      } else if (selectedMonth !== 'ALL') {
        const targetMonth = parseInt(selectedMonth, 10);
        if (m < targetMonth) {
          bal += (item.inflowAmount - item.outflowAmount);
        }
      }
    });
    return Math.round(bal * 10000) / 10000;
  }, [allJournalItems, bkkSettings.initialBalance, selectedMonth, selectedYear, bkkSettings.initialBalanceDate]);

  // Running Balance (Saldo Berjalan)
  const itemsWithRunningBalance = useMemo(() => {
    let currentBalance = priorBalance;
    return filteredJournalItems.map(item => {
      currentBalance = Math.round((currentBalance + item.inflowAmount - item.outflowAmount) * 10000) / 10000;
      return {
        ...item,
        runningBalance: currentBalance,
      };
    });
  }, [filteredJournalItems, priorBalance]);

  // Final Saldo Akhir (Real Saldo Akhir Kas)
  const finalBalance = realFinalBalance;

  // --- Handlers: Saldo Awal ---
  const handleOpenSaldoModal = () => {
    setSaldoInput((bkkSettings.initialBalance ?? 0).toString());
    setSaldoDateInput(bkkSettings.initialBalanceDate || '2026-09-01');
    setSaldoNotesInput(bkkSettings.notes || '');
    setShowSaldoModal(true);
  };

  const handleSaveSaldoAwal = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseAmount(saldoInput);
    setSavingSaldo(true);
    try {
      const newSettings: BkkSettings = {
        initialBalance: val,
        initialBalanceDate: saldoDateInput || '2026-09-01',
        notes: saldoNotesInput || `Saldo awal kas per ${initialDateDisplay}`,
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'bkk_settings', 'general'), newSettings, { merge: true });
      setBkkSettings(newSettings);
      localStorage.setItem('bkk_settings_cache', JSON.stringify(newSettings));
      setShowSaldoModal(false);
      safeAlert("Saldo awal kas berhasil disimpan!");
    } catch (err: any) {
      console.error("Gagal simpan saldo awal:", err);
      safeAlert("Gagal menyimpan saldo awal: " + (err.message || 'Terjadi kesalahan'));
    } finally {
      setSavingSaldo(false);
    }
  };

  // --- Handlers: Pindah Buku (Penerimaan) ---
  const handleOpenAddPindahBuku = () => {
    setEditingInflow(null);
    const nextNum = (cashInflows.length + 1).toString().padStart(3, '0');
    setPindahBukuForm({
      date: new Date().toISOString().split('T')[0],
      noBukti: `BKM/PB-${nextNum}`,
      sourceAccount: 'Bank Jateng',
      category: 'Pindah Buku Rekening Bank',
      description: '',
      amount: '',
      receivedFrom: 'Bendahara Sekolah',
      notes: '',
    });
    setShowPindahBukuModal(true);
  };

  const handleOpenEditPindahBuku = (item: CashInflow) => {
    setEditingInflow(item);
    setPindahBukuForm({
      date: item.date || new Date().toISOString().split('T')[0],
      noBukti: item.noBukti || '',
      sourceAccount: item.sourceAccount || 'Bank Jateng',
      category: item.category || 'Pindah Buku Rekening Bank',
      description: item.description || '',
      amount: item.amount ? item.amount.toString() : '',
      receivedFrom: item.receivedFrom || 'Bendahara Sekolah',
      notes: item.notes || '',
    });
    setShowPindahBukuModal(true);
  };

  const handleSavePindahBuku = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseAmount(pindahBukuForm.amount);
    if (!pindahBukuForm.description.trim()) {
      safeAlert("Harap isi uraian penerimaan / pindah buku!");
      return;
    }
    if (amt <= 0) {
      safeAlert("Nominal penerimaan harus lebih dari Rp 0!");
      return;
    }

    setSavingPindahBuku(true);
    try {
      const payload: CashInflow = {
        date: pindahBukuForm.date,
        noBukti: pindahBukuForm.noBukti.trim() || `BKM/PB-${Date.now().toString().slice(-4)}`,
        sourceAccount: pindahBukuForm.sourceAccount.trim(),
        category: pindahBukuForm.category.trim(),
        description: pindahBukuForm.description.trim(),
        amount: amt,
        receivedFrom: pindahBukuForm.receivedFrom.trim(),
        notes: pindahBukuForm.notes.trim(),
      };

      if (editingInflow && editingInflow.id) {
        await updateDoc(doc(db, 'cash_inflows', editingInflow.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        safeAlert("Transaksi Pindah Buku penerimaan berhasil diperbarui!");
      } else {
        await addDoc(collection(db, 'cash_inflows'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        safeAlert("Transaksi Pindah Buku penerimaan baru berhasil ditambahkan!");
      }
      setShowPindahBukuModal(false);
    } catch (err: any) {
      console.error("Gagal simpan pindah buku:", err);
      safeAlert("Gagal menyimpan pindah buku: " + (err.message || 'Terjadi kesalahan'));
    } finally {
      setSavingPindahBuku(false);
    }
  };

  const handleDeletePindahBuku = async (id: string, noBukti: string) => {
    if (!safeConfirm(`Hapus transaksi pindah buku ${noBukti}?`)) return;
    try {
      await deleteDoc(doc(db, 'cash_inflows', id));
      safeAlert(`Transaksi ${noBukti} berhasil dihapus.`);
    } catch (err: any) {
      console.error("Gagal hapus pindah buku:", err);
      safeAlert("Gagal menghapus transaksi.");
    }
  };

  // --- Handlers: Direct Cash Outflow ---
  const handleOpenAddDirect = () => {
    setEditingDirect(null);
    const nextNum = (directOutflows.length + 1).toString().padStart(3, '0');
    setDirectForm({
      date: new Date().toISOString().split('T')[0],
      noBukti: `BKK/DIR-${nextNum}`,
      unitName: 'Umum / Bendahara',
      category: 'Operasional Kas Sekolah',
      description: '',
      amount: '',
      employeeName: '',
      notes: '',
    });
    setShowDirectModal(true);
  };

  const handleOpenEditDirect = (item: DirectCashOutflow) => {
    setEditingDirect(item);
    setDirectForm({
      date: item.date || new Date().toISOString().split('T')[0],
      noBukti: item.noBukti || '',
      unitName: item.unitName || 'Umum / Bendahara',
      category: item.category || 'Operasional Kas Sekolah',
      description: item.description || '',
      amount: item.amount ? item.amount.toString() : '',
      employeeName: item.employeeName || '',
      notes: item.notes || '',
    });
    setShowDirectModal(true);
  };

  const handleSaveDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseAmount(directForm.amount);
    if (!directForm.description.trim()) {
      safeAlert("Harap isi uraian pengeluaran belanja!");
      return;
    }
    if (amt <= 0) {
      safeAlert("Nominal pengeluaran harus lebih dari Rp 0!");
      return;
    }

    setSavingDirect(true);
    try {
      const payload: DirectCashOutflow = {
        date: directForm.date,
        noBukti: directForm.noBukti.trim() || `BKK/DIR-${Date.now().toString().slice(-4)}`,
        unitName: directForm.unitName,
        category: directForm.category,
        description: directForm.description.trim(),
        amount: amt,
        employeeName: directForm.employeeName.trim(),
        notes: directForm.notes.trim(),
      };

      if (editingDirect && editingDirect.id) {
        await updateDoc(doc(db, 'direct_cash_outflows', editingDirect.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        safeAlert("Transaksi kas non-LPJ berhasil diperbarui!");
      } else {
        await addDoc(collection(db, 'direct_cash_outflows'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        safeAlert("Transaksi kas non-LPJ baru berhasil ditambahkan!");
      }
      setShowDirectModal(false);
    } catch (err: any) {
      console.error("Gagal simpan transaksi langsung:", err);
      safeAlert("Gagal menyimpan transaksi: " + (err.message || 'Terjadi kesalahan'));
    } finally {
      setSavingDirect(false);
    }
  };

  const handleDeleteDirect = async (id: string, noBukti: string) => {
    if (!safeConfirm(`Hapus transaksi kas keluar ${noBukti}?`)) return;
    try {
      await deleteDoc(doc(db, 'direct_cash_outflows', id));
      safeAlert(`Transaksi ${noBukti} berhasil dihapus.`);
    } catch (err: any) {
      console.error("Gagal hapus transaksi langsung:", err);
      safeAlert("Gagal menghapus transaksi.");
    }
  };

  // --- Print Official Buku Kas ---
  const handlePrintBukuKas = () => {
    let printWindow: Window | null = null;
    try {
      printWindow = window.open('', '_blank');
    } catch (e) {
      console.error("Popup blocked", e);
    }
    if (!printWindow) {
      safeAlert("Popup terblokir oleh peramban. Harap izinkan popup untuk mencetak Buku Kas.");
      return;
    }

    const monthNames: Record<string, string> = {
      '1': 'Januari', '2': 'Februari', '3': 'Maret', '4': 'April',
      '5': 'Mei', '6': 'Juni', '7': 'Juli', '8': 'Agustus',
      '9': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember'
    };

    let periodLabel = 'Seluruh Periode';
    if (selectedMonth !== 'ALL' && selectedYear !== 'ALL') {
      periodLabel = `Bulan ${monthNames[selectedMonth]} ${selectedYear}`;
    } else if (selectedMonth !== 'ALL') {
      periodLabel = `Bulan ${monthNames[selectedMonth]}`;
    } else if (selectedYear !== 'ALL') {
      periodLabel = `Tahun Anggaran ${selectedYear}`;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Buku Kas Umum / Keluar - SMK Muhammadiyah 1 Ngadirejo</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;600&display=swap');
            
            @page {
              size: A4 landscape;
              margin: 1.2cm 1.4cm;
            }

            body {
              font-family: 'Crimson Pro', serif;
              color: #111;
              line-height: 1.3;
              font-size: 9.5pt;
              margin: 0;
              padding: 0;
            }

            .kop {
              text-align: center;
              border-bottom: 3px double #000;
              padding-bottom: 6px;
              margin-bottom: 12px;
            }

            .kop h1 {
              font-size: 16pt;
              font-weight: 700;
              margin: 0 0 2px 0;
            }

            .kop p {
              margin: 0;
              font-size: 8.5pt;
              color: #333;
              font-style: italic;
            }

            .doc-title {
              text-align: center;
              margin-bottom: 12px;
            }

            .doc-title h2 {
              margin: 0;
              font-size: 13pt;
              font-weight: 700;
              text-decoration: underline;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }

            .doc-title p {
              margin: 2px 0 0 0;
              font-size: 9pt;
              font-style: italic;
            }

            .saldo-akhir-hero {
              border: 1.5px solid #000;
              background-color: #fbfbfb;
              padding: 8px 14px;
              margin-bottom: 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }

            .saldo-akhir-hero .lbl {
              font-size: 9pt;
              font-weight: bold;
              text-transform: uppercase;
            }

            .saldo-akhir-hero .val {
              font-family: 'JetBrains Mono', monospace;
              font-size: 13pt;
              font-weight: bold;
              color: #000;
            }

            .saldo-breakdown {
              font-size: 8.5pt;
              color: #444;
              font-family: 'JetBrains Mono', monospace;
            }

            table.bkk-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
              font-size: 8.5pt;
            }

            table.bkk-table th {
              background-color: #eaeaea;
              border: 1px solid #000;
              padding: 5px 4px;
              font-weight: 700;
              text-align: center;
            }

            table.bkk-table td {
              border: 1px solid #000;
              padding: 4px 5px;
              vertical-align: top;
            }

            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-mono { font-family: 'JetBrains Mono', monospace; }

            .terbilang-box {
              border: 1px solid #000;
              padding: 6px 10px;
              margin-bottom: 16px;
              background-color: #fafafa;
              font-size: 9pt;
            }

            .signature-wrapper {
              margin-top: 18px;
              display: flex;
              justify-content: space-between;
              page-break-inside: avoid;
              font-size: 9.5pt;
            }

            .sign-box {
              width: 40%;
              text-align: center;
            }

            .sign-box .space {
              height: 55px;
            }

            .sign-name {
              font-weight: bold;
              text-decoration: underline;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="kop">
            <h1>SMK MUHAMMADIYAH 1 NGADIREJO</h1>
            <p>Alamat: Jl. Raya Candiroto, Ngaren, Ngadirejo, Temanggung, Jawa Tengah</p>
          </div>

          <div class="doc-title">
            <h2>Buku Kas (Penerimaan &amp; Pengeluaran)</h2>
            <p>${periodLabel}</p>
          </div>

          <div class="saldo-akhir-hero">
            <div>
              <div class="lbl">Saldo Akhir Kas (Real Kas):</div>
              <div class="saldo-breakdown">
                (Saldo Awal ${initialDateDisplay}: Rp ${formatCurrency(bkkSettings.initialBalance || 0)} + Total Penerimaan Kas Riil: Rp ${formatCurrency(realTotalInflow)} - Total Pengeluaran Kas Riil: Rp ${formatCurrency(realTotalOutflow)})
              </div>
            </div>
            <div class="val">
              Rp ${formatCurrency(realFinalBalance)}
            </div>
          </div>

          <table class="bkk-table">
            <thead>
              <tr>
                <th style="width: 3%;">No</th>
                <th style="width: 8%;">Tgl Transaksi</th>
                <th style="width: 8%;">Tgl Instruksi</th>
                <th style="width: 10%;">No. Bukti</th>
                <th style="width: 14%;">Unit &amp; Kegiatan / Sumber</th>
                <th style="width: 12%;">Pos Transaksi</th>
                <th>Uraian Transaksi</th>
                <th style="width: 10%;">Pihak / Rek</th>
                <th style="width: 10%;">Penerimaan (Rp)</th>
                <th style="width: 10%;">Pengeluaran (Rp)</th>
                <th style="width: 10%;">Saldo Kas (Rp)</th>
              </tr>
            </thead>
            <tbody>
              <!-- Saldo Awal Row -->
              <tr style="background-color: #fcfcfc; font-weight: bold;">
                <td class="text-center">-</td>
                <td class="text-center font-mono">${formatDate(bkkSettings.initialBalanceDate, { dateStyle: 'short' })}</td>
                <td class="text-center">-</td>
                <td class="font-mono">SALDO-AWAL</td>
                <td colspan="4">SALDO AWAL KAS SEKOLAH (${bkkSettings.notes || 'Awal Periode'})</td>
                <td class="text-right font-mono">-</td>
                <td class="text-right font-mono">-</td>
                <td class="text-right font-mono" style="background-color: #f0fdf4;">${formatCurrency(bkkSettings.initialBalance || 0)}</td>
              </tr>

              ${itemsWithRunningBalance.length > 0 ? itemsWithRunningBalance.map((item, idx) => `
                <tr ${
                  item.itemType === 'lpj_remaining' ? 'style="background-color: #fffbeb;"' : 
                  item.itemType === 'lpj_deficit' ? 'style="background-color: #fff1f2;"' :
                  item.itemType === 'lpj_allocation' ? 'style="background-color: #eff6ff;"' :
                  item.itemType === 'inflow_pindah_buku' ? 'style="background-color: #f0fdf4;"' : ''
                }>
                  <td class="text-center">${idx + 1}</td>
                  <td class="text-center font-mono">${formatDate(item.date, { dateStyle: 'short' })}</td>
                  <td class="text-center font-mono" style="color: #444;">${item.instructionDate ? formatDate(item.instructionDate, { dateStyle: 'short' }) : '-'}</td>
                  <td class="font-mono" style="font-weight: 600;">${item.noBukti}</td>
                  <td>
                    <strong>${item.unitName}</strong><br/>
                    <span style="font-size: 7.5pt; color: #555;">${item.activityName}</span>
                  </td>
                  <td>
                    ${item.category}
                    ${item.itemType === 'lpj_remaining' ? '<br/><em style="color:#b45309; font-size:7.5pt;">[Sisa Anggaran di Urutan Bawah]</em>' : ''}
                    ${item.itemType === 'lpj_deficit' ? '<br/><em style="color:#be123c; font-size:7.5pt;">[Kekurangan Anggaran (Penerimaan)]</em>' : ''}
                    ${item.itemType === 'lpj_allocation' ? '<br/><em style="color:#1d4ed8; font-size:7.5pt;">[Alokasi Anggaran Total]</em>' : ''}
                    ${item.itemType === 'inflow_pindah_buku' ? '<br/><em style="color:#15803d; font-size:7.5pt;">[Pindah Buku Bank]</em>' : ''}
                  </td>
                  <td>${item.description}</td>
                  <td>${item.partyName}</td>
                  <td class="text-right font-mono" style="font-weight: 600; color: #15803d;">
                    ${item.inflowAmount > 0 ? formatCurrency(item.inflowAmount) : '-'}
                  </td>
                  <td class="text-right font-mono" style="font-weight: 600; color: #b91c1c;">
                    ${item.outflowAmount > 0 ? formatCurrency(item.outflowAmount) : '-'}
                  </td>
                  <td class="text-right font-mono" style="font-weight: 600; color: ${item.runningBalance >= 0 ? '#15803d' : '#b91c1c'}; background-color: #fafafa;">
                    ${formatCurrency(item.runningBalance)}
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="11" class="text-center" style="padding: 16px; font-style: italic;">
                    Tidak ada transaksi pada buku kas sesuai filter.
                  </td>
                </tr>
              `}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold; background-color: #eaeaea;">
                <td colspan="8" class="text-right" style="padding: 6px;">TOTAL TRANSAKSI PERIODE INI &amp; SALDO AKHIR KAS (REAL):</td>
                <td class="text-right font-mono" style="padding: 6px; color: #15803d;">Rp ${formatCurrency(totalInflow)}</td>
                <td class="text-right font-mono" style="padding: 6px; color: #b91c1c;">Rp ${formatCurrency(totalOutflow)}</td>
                <td class="text-right font-mono" style="padding: 6px; font-size: 10pt; color: ${realFinalBalance >= 0 ? '#15803d' : '#b91c1c'};">
                  Rp ${formatCurrency(realFinalBalance)}
                </td>
              </tr>
            </tfoot>
          </table>

          <div class="terbilang-box">
            <div><strong>Terbilang Saldo Akhir Kas:</strong> <em>${terbilang(Math.abs(realFinalBalance))} ${realFinalBalance < 0 ? '(Defisit)' : 'Rupiah'}</em></div>
          </div>

          <div class="signature-wrapper">
            <div class="sign-box">
              <p style="margin: 0 0 4px 0;">Mengetahui,</p>
              <p style="margin: 0;">Kepala SMK Muhammadiyah 1 Ngadirejo</p>
              <div class="space"></div>
              <p class="sign-name">H. Supriyadi, S.Pd., M.Si.</p>
              <p style="margin: 2px 0 0 0; font-size: 8pt;">NBM. .................................</p>
            </div>

            <div class="sign-box">
              <p style="margin: 0 0 4px 0;">Ngadirejo, ${formatDate(new Date(), { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p style="margin: 0;">Bendahara Sekolah,</p>
              <div class="space"></div>
              <p class="sign-name">Bendahara Utama</p>
              <p style="margin: 2px 0 0 0; font-size: 8pt;">NBM. .................................</p>
            </div>
          </div>

          <script>
            window.print();
            setTimeout(() => window.close(), 1200);
          </script>
        </body>
      </html>
    `;

    try {
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (e) {
      console.error("Print error:", e);
      safeAlert("Gagal membuka jendela cetak.");
    }
  };

  // Print Single Voucher (BKM / BKK)
  const handlePrintVoucher = (item: UnifiedJournalItem) => {
    let printWindow: Window | null = null;
    try {
      printWindow = window.open('', '_blank');
    } catch (e) {
      console.error("Popup blocked", e);
    }
    if (!printWindow) {
      safeAlert("Popup terblokir oleh browser.");
      return;
    }

    const isInflow = item.inflowAmount > 0;
    const title = isInflow ? 'BUKTI KAS MASUK (BKM) - PINDAH BUKU' : 'BUKTI PENGELUARAN KAS (BKK)';
    const nominal = isInflow ? item.inflowAmount : item.outflowAmount;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - ${item.noBukti}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;600&display=swap');
            @page { size: A4 portrait; margin: 1.5cm; }
            body { font-family: 'Crimson Pro', serif; color: #111; font-size: 11pt; line-height: 1.4; margin: 0; }
            .voucher-box { border: 2px solid #000; padding: 24px; }
            .kop { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px; }
            .kop h1 { font-size: 16pt; margin: 0; font-weight: 700; }
            .kop p { margin: 2px 0 0 0; font-size: 9pt; font-style: italic; }
            .header-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
            .header-info h2 { margin: 0; font-size: 13.5pt; text-decoration: underline; }
            .no-bukti-box { font-family: 'JetBrains Mono', monospace; border: 1px solid #000; padding: 4px 10px; font-weight: bold; font-size: 10pt; background: #f9f9f9; }
            table.content-table { width: 100%; margin-bottom: 20px; border-collapse: collapse; }
            table.content-table td { padding: 6px 4px; vertical-align: top; }
            .nominal-badge { font-family: 'JetBrains Mono', monospace; font-size: 14pt; font-weight: bold; background: #f0f0f0; border: 1px solid #333; padding: 8px 16px; display: inline-block; margin-top: 10px; }
            .signatures { margin-top: 35px; display: flex; justify-content: space-between; text-align: center; }
            .sign-col { width: 30%; }
            .sign-col .space { height: 60px; }
            .sign-col p { margin: 0; }
            .sign-name { font-weight: bold; text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="voucher-box">
            <div class="kop">
              <h1>SMK MUHAMMADIYAH 1 NGADIREJO</h1>
              <p>Alamat: Jl. Raya Candiroto, Ngaren, Ngadirejo, Temanggung</p>
            </div>

            <div class="header-info">
              <h2>${title}</h2>
              <div class="no-bukti-box">NO: ${item.noBukti}</div>
            </div>

            <table class="content-table">
              <tr>
                <td style="width: 26%; font-weight: bold;">${isInflow ? 'Diterima Dari' : 'Dibayarkan Kepada'}</td>
                <td style="width: 3%;">:</td>
                <td style="font-weight: bold;">${item.partyName}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Unit / Pos Transaksi</td>
                <td>:</td>
                <td>${item.unitName} &bull; ${item.category}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Tanggal Transaksi</td>
                <td>:</td>
                <td>${formatDate(item.date, { day: 'numeric', month: 'long', year: 'numeric' })}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Uraian Transaksi</td>
                <td>:</td>
                <td>${item.description}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Jumlah Uang</td>
                <td>:</td>
                <td>
                  <div class="nominal-badge">Rp ${formatCurrency(nominal)}</div>
                </td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Terbilang</td>
                <td>:</td>
                <td style="font-style: italic; font-weight: 600; padding-top: 8px;">"${terbilang(nominal)}"</td>
              </tr>
            </table>

            <div class="signatures">
              <div class="sign-col">
                <p>Mengetahui,</p>
                <p>Kepala Sekolah / Atasan</p>
                <div class="space"></div>
                <p class="sign-name">H. Supriyadi, S.Pd., M.Si.</p>
              </div>

              <div class="sign-col">
                <p>${isInflow ? 'Diserahkan Oleh,' : 'Penerima Uang,'}</p>
                <div class="space"></div>
                <p class="sign-name">${item.partyName || '...............................'}</p>
              </div>

              <div class="sign-col">
                <p>${isInflow ? 'Diterima Kasir,' : 'Lunas Dibayar,'}</p>
                <p>Bendahara Sekolah</p>
                <div class="space"></div>
                <p class="sign-name">Bendahara Utama</p>
              </div>
            </div>
          </div>
          <script>window.print(); setTimeout(() => window.close(), 1000);</script>
        </body>
      </html>
    `;

    try {
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (e) {
      console.error("Voucher error:", e);
      safeAlert("Gagal mencetak bukti voucher.");
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="p-2.5 rounded-2xl bg-natural-primary/10 text-natural-primary border border-natural-primary/20">
              <BookOpen className="w-6 h-6" />
            </span>
            <span className="text-[10px] font-bold text-natural-secondary uppercase tracking-[0.25em]">
              Buku Kas &bull; SMK Muhammadiyah 1 Ngadirejo
            </span>
          </div>
          <h2 className="text-4xl font-serif italic text-natural-primary tracking-tight">
            Buku Kas
          </h2>
          <p className="text-natural-secondary text-sm uppercase tracking-widest font-light mt-1">
            Pencatatan Penerimaan (Pindah Buku Bank) dan Pengeluaran Kas Sekolah
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              title="Segarkan Data"
              className="p-3 bg-natural-input border border-natural-border rounded-full hover:bg-white transition-all disabled:opacity-50 shadow-xs"
            >
              <RotateCw className={`w-5 h-5 text-natural-secondary ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Tombol Tambah Pindah Buku (Penerimaan) */}
          <button
            onClick={handleOpenAddPindahBuku}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
          >
            <ArrowDownLeft className="w-4 h-4" />
            + Tambah Pindah Buku (Penerimaan)
          </button>

          {/* Tombol Tambah Transaksi Kas (Non-LPJ) */}
          <button
            onClick={handleOpenAddDirect}
            className="bg-white text-natural-primary border border-natural-border hover:border-natural-primary hover:bg-natural-bg/40 px-5 py-3 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-xs"
          >
            <ArrowUpRight className="w-4 h-4 text-red-600" />
            + Transaksi Kas Keluar (Non-LPJ)
          </button>

          {/* Atur Saldo Awal */}
          <button
            onClick={handleOpenSaldoModal}
            className="bg-white text-natural-secondary border border-natural-border hover:border-natural-primary hover:text-natural-primary px-5 py-3 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-xs"
          >
            <Wallet className="w-4 h-4 text-emerald-600" />
            Atur Saldo Awal
          </button>

          {/* Cetak Buku Kas */}
          <button
            onClick={handlePrintBukuKas}
            disabled={filteredJournalItems.length === 0}
            className="bg-natural-primary text-white px-6 py-3 rounded-full font-serif italic flex items-center gap-2 hover:bg-natural-primary/90 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            Cetak Buku Kas
          </button>
        </div>
      </div>

      {/* SINGLE HERO SUMMARY: "saldo akhir muncul bukan berdasarkan filter tetapi real saldo akhir saja" */}
      <div className={`p-8 rounded-[36px] border shadow-xs transition-all ${
        realFinalBalance >= 0 ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/60 border-red-200'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-natural-secondary uppercase tracking-[0.25em]">
                Saldo Kas Tersedia (Real)
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                realFinalBalance >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}>
                {realFinalBalance >= 0 ? 'Surplus / Kas Tersedia' : 'Peringatan Defisit'}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <h3 className={`text-4xl sm:text-5xl font-mono font-bold tracking-tight ${
                realFinalBalance >= 0 ? 'text-emerald-800' : 'text-red-700'
              }`}>
                Rp {formatCurrency(realFinalBalance)}
              </h3>
            </div>
            <p className="text-xs text-natural-secondary italic pt-1">
              Terbilang: {terbilang(Math.abs(realFinalBalance))} {realFinalBalance < 0 ? '(Defisit)' : 'Rupiah'}
            </p>
            <p className="text-[10px] text-natural-secondary/70 italic">
              *Saldo akhir kas riil kumulatif (tidak dipotong oleh filter periode)
            </p>
          </div>

          {/* Simple Formula Breakdown (Kumulatif Riil) */}
          <div className="bg-white/80 backdrop-blur-xs p-5 rounded-2xl border border-natural-border/70 flex flex-wrap items-center gap-6 text-xs">
            <div>
              <span className="text-[10px] font-bold text-natural-secondary uppercase tracking-wider block">
                Saldo Awal ({initialDateDisplay})
              </span>
              <span className="font-mono font-bold text-natural-primary text-sm">
                Rp {formatCurrency(bkkSettings.initialBalance || 0)}
              </span>
            </div>
            <span className="text-natural-secondary/60 text-base font-bold">+</span>
            <div>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                Total Penerimaan (Riil)
              </span>
              <span className="font-mono font-bold text-emerald-700 text-sm">
                Rp {formatCurrency(realTotalInflow)}
              </span>
            </div>
            <span className="text-natural-secondary/60 text-base font-bold">-</span>
            <div>
              <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">
                Total Pengeluaran (Riil)
              </span>
              <span className="font-mono font-bold text-red-700 text-sm">
                Rp {formatCurrency(realTotalOutflow)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Periode: Hanya Bulan & Tahun (Default: Bulan Berjalan) */}
      <div className="bg-white p-5 sm:p-6 rounded-[28px] border border-natural-border shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-natural-bg flex items-center justify-center text-natural-primary border border-natural-border/60">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-natural-text">
                Filter Periode Buku Kas
              </h4>
              <p className="text-[11px] text-natural-secondary">
                {isFilterBeforeBukuKasStart ? (
                  <span className="text-amber-700 font-medium">Periode sebelum {initialDateDisplay}: transaksi dikosongkan</span>
                ) : (
                  <>Menampilkan {filteredJournalItems.length} transaksi pada pembukuan</>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Filter Bulan */}
            <div className="flex items-center gap-2 flex-1 sm:flex-initial">
              <label className="text-xs font-bold text-natural-secondary whitespace-nowrap">
                Bulan:
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full sm:w-44 px-3.5 py-2 bg-natural-bg/70 hover:bg-natural-bg border border-natural-border rounded-xl text-xs font-medium text-natural-text focus:outline-hidden focus:border-natural-primary focus:bg-white transition-all cursor-pointer"
              >
                <option value="ALL">Semua Bulan</option>
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Tahun */}
            <div className="flex items-center gap-2 flex-1 sm:flex-initial">
              <label className="text-xs font-bold text-natural-secondary whitespace-nowrap">
                Tahun:
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full sm:w-36 px-3.5 py-2 bg-natural-bg/70 hover:bg-natural-bg border border-natural-border rounded-xl text-xs font-medium text-natural-text focus:outline-hidden focus:border-natural-primary focus:bg-white transition-all cursor-pointer"
              >
                <option value="ALL">Semua Tahun</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Tombol Bulan Berjalan */}
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                setSelectedMonth((d.getMonth() + 1).toString());
                setSelectedYear(d.getFullYear().toString());
              }}
              className={`text-[11px] font-bold px-3 py-2 rounded-xl transition-all border flex items-center gap-1.5 ${
                selectedMonth === defaultCurrentMonth && selectedYear === defaultCurrentYear
                  ? 'bg-natural-primary text-white border-natural-primary shadow-xs'
                  : 'bg-natural-bg text-natural-primary border-natural-border hover:bg-natural-border/60'
              }`}
              title="Reset ke Bulan Berjalan"
            >
              <Calendar className="w-3.5 h-3.5" />
              Bulan Berjalan
            </button>

            {/* Reset ke Semua Periode */}
            {(selectedMonth !== 'ALL' || selectedYear !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedMonth('ALL');
                  setSelectedYear('ALL');
                }}
                className="text-[11px] font-bold text-natural-secondary hover:text-natural-primary hover:bg-natural-bg px-3 py-2 rounded-xl transition-all border border-natural-border"
                title="Tampilkan Semua Periode"
              >
                Semua Periode
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Header (Simplified: purely Buku Kas, Pindah Buku, Non-LPJ) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-natural-border pb-2">
        <button
          onClick={() => setActiveTab('journal')}
          className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'journal'
              ? 'bg-natural-primary text-white shadow-md'
              : 'text-natural-secondary hover:bg-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Buku Kas ({itemsWithRunningBalance.length})
        </button>

        <button
          onClick={() => setActiveTab('pindah_buku_list')}
          className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'pindah_buku_list'
              ? 'bg-emerald-700 text-white shadow-md'
              : 'text-natural-secondary hover:bg-white'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          Pindah Buku / Penerimaan ({cashInflows.length})
        </button>

        <button
          onClick={() => setActiveTab('direct_list')}
          className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'direct_list'
              ? 'bg-natural-primary text-white shadow-md'
              : 'text-natural-secondary hover:bg-white'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Kas Keluar Non-LPJ ({directOutflows.length})
        </button>
      </div>

      {/* Tab 1: Unified Buku Kas (Penerimaan & Pengeluaran) */}
      {activeTab === 'journal' && (
        <div className="bg-white rounded-[36px] border border-natural-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-natural-border bg-natural-bg/50 text-[10px] uppercase tracking-wider text-natural-secondary font-bold">
                  <th className="py-4 px-3 text-center w-12">No</th>
                  <th className="py-4 px-3 w-24">Tgl Transaksi</th>
                  <th className="py-4 px-3 w-24">Tgl Instruksi</th>
                  <th className="py-4 px-3 w-32">No. Bukti</th>
                  <th className="py-4 px-4 w-40">Unit &amp; Kegiatan / Sumber</th>
                  <th className="py-4 px-4 w-36">Pos Transaksi</th>
                  <th className="py-4 px-5 min-w-[200px]">Uraian Transaksi</th>
                  <th className="py-4 px-3 w-28">Pihak / Rek</th>
                  <th className="py-4 px-4 text-right w-32 text-emerald-700">Penerimaan (Rp)</th>
                  <th className="py-4 px-4 text-right w-32 text-red-700">Pengeluaran (Rp)</th>
                  <th className="py-4 px-4 text-right w-36">Saldo Kas (Rp)</th>
                  <th className="py-4 px-3 text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-natural-border/50 text-xs">
                {/* Saldo Awal Header Row */}
                <tr className="bg-emerald-50/40 font-bold border-b border-emerald-100">
                  <td className="py-3 px-3 text-center font-mono text-[11px] text-emerald-800">-</td>
                  <td className="py-3 px-3 font-mono text-[11px] text-emerald-900">
                    {formatDate(bkkSettings.initialBalanceDate, { dateStyle: 'short' })}
                  </td>
                  <td className="py-3 px-3 text-center text-emerald-700">-</td>
                  <td className="py-3 px-3">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      SALDO-AWAL
                    </span>
                  </td>
                  <td colSpan={4} className="py-3 px-4 text-emerald-900">
                    <span className="font-serif italic font-bold">SALDO AWAL KAS SEKOLAH</span>
                    <span className="text-[11px] font-sans font-normal text-emerald-700 ml-2">
                      ({bkkSettings.notes || 'Saldo Awal Pembukuan'})
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700">-</td>
                  <td className="py-3 px-4 text-right font-mono text-red-700">-</td>
                  <td className="py-3 px-4 text-right font-mono text-sm font-bold text-emerald-800">
                    Rp {formatCurrency(bkkSettings.initialBalance || 0)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={handleOpenSaldoModal}
                      title="Atur Saldo Awal"
                      className="p-1 rounded bg-white text-emerald-700 border border-emerald-300 text-[10px] hover:bg-emerald-100 transition-all font-bold px-2"
                    >
                      Ubah
                    </button>
                  </td>
                </tr>

                {itemsWithRunningBalance.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center text-natural-secondary">
                      {isFilterBeforeBukuKasStart ? (
                        <div className="max-w-md mx-auto space-y-1.5 py-4">
                          <p className="font-semibold text-natural-primary text-sm">
                            Tidak Ada Transaksi Sebelum {initialDateDisplay}
                          </p>
                          <p className="text-xs text-natural-secondary italic">
                            Pembukuan Buku Kas efektif dimulai per {initialDateDisplay}. Seluruh transaksi sebelum periode ini dikosongkan.
                          </p>
                        </div>
                      ) : (
                        <span className="italic">Tidak ada transaksi kas pada periode terpilih.</span>
                      )}
                    </td>
                  </tr>
                ) : (
                  itemsWithRunningBalance.map((item, index) => (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-natural-bg/30 transition-colors group ${
                        item.itemType === 'lpj_remaining' ? 'bg-amber-50/25' : 
                        item.itemType === 'lpj_deficit' ? 'bg-rose-50/25' :
                        item.itemType === 'lpj_allocation' ? 'bg-blue-50/25' :
                        item.itemType === 'inflow_pindah_buku' ? 'bg-emerald-50/25' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center font-mono text-[11px] text-natural-secondary">
                        {index + 1}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-natural-text whitespace-nowrap">
                        {formatDate(item.date, { dateStyle: 'short' })}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-natural-secondary whitespace-nowrap">
                        {item.instructionDate ? formatDate(item.instructionDate, { dateStyle: 'short' }) : '-'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${
                          item.inflowAmount > 0 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                            : 'bg-natural-primary/5 text-natural-primary border-natural-primary/10'
                        }`}>
                          {item.noBukti}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-natural-text leading-tight">{item.unitName}</p>
                        <p className="text-[10px] text-natural-secondary truncate max-w-[150px] leading-snug mt-0.5" title={item.activityName}>
                          {item.activityName}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-natural-bg border border-natural-border font-medium text-natural-secondary">
                          {item.category}
                        </span>
                        {item.itemType === 'inflow_pindah_buku' && (
                          <span className="block mt-0.5 text-[9px] text-emerald-700 font-bold uppercase tracking-wider">
                            Pindah Buku Bank
                          </span>
                        )}
                        {item.itemType === 'lpj_remaining' && (
                          <span className="block mt-0.5 text-[9px] text-amber-700 font-bold uppercase tracking-wider">
                            Sisa Anggaran (Urutan Bawah)
                          </span>
                        )}
                        {item.itemType === 'lpj_deficit' && (
                          <span className="block mt-0.5 text-[9px] text-rose-700 font-bold uppercase tracking-wider">
                            Kekurangan Anggaran (Penerimaan)
                          </span>
                        )}
                        {item.itemType === 'lpj_allocation' && (
                          <span className="block mt-0.5 text-[9px] text-blue-700 font-bold uppercase tracking-wider">
                            Alokasi Anggaran Total
                          </span>
                        )}
                        {item.itemType === 'direct_outflow' && (
                          <span className="block mt-0.5 text-[9px] text-blue-700 font-bold uppercase tracking-wider">
                            Non-LPJ Langsung
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-5 text-natural-text leading-relaxed">
                        <div className="font-medium">{item.description}</div>
                        {item.notes && (
                          <div className="text-[10px] text-natural-secondary italic mt-0.5">{item.notes}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-natural-secondary text-xs truncate max-w-[120px]">
                        {item.partyName || '-'}
                      </td>
                      {/* Kolom Penerimaan (Rp) */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                        {item.inflowAmount > 0 ? formatCurrency(item.inflowAmount) : '-'}
                      </td>
                      {/* Kolom Pengeluaran (Rp) */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-red-600 whitespace-nowrap">
                        {item.outflowAmount > 0 ? formatCurrency(item.outflowAmount) : '-'}
                      </td>
                      {/* Kolom Saldo Kas (Rp) */}
                      <td className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap ${
                        item.runningBalance! >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}>
                        {formatCurrency(item.runningBalance!)}
                      </td>
                      {/* Aksi */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handlePrintVoucher(item)}
                            title={item.inflowAmount > 0 ? "Cetak Bukti Kas Masuk" : "Cetak Kuitansi BKK"}
                            className="p-1.5 rounded-lg bg-natural-bg hover:bg-natural-primary hover:text-white text-natural-secondary border border-natural-border transition-all"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>
                          {item.itemType === 'inflow_pindah_buku' && item.inflowData && (
                            <>
                              <button
                                onClick={() => handleOpenEditPindahBuku(item.inflowData!)}
                                title="Edit Pindah Buku"
                                className="p-1.5 rounded-lg bg-natural-bg hover:bg-emerald-600 hover:text-white text-natural-secondary border border-natural-border transition-all"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePindahBuku(item.inflowId!, item.noBukti)}
                                title="Hapus Pindah Buku"
                                className="p-1.5 rounded-lg bg-natural-bg hover:bg-red-600 hover:text-white text-natural-secondary border border-natural-border transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {item.itemType === 'direct_outflow' && item.directData && (
                            <>
                              <button
                                onClick={() => handleOpenEditDirect(item.directData!)}
                                title="Edit Transaksi Non-LPJ"
                                className="p-1.5 rounded-lg bg-natural-bg hover:bg-natural-secondary hover:text-white text-natural-secondary border border-natural-border transition-all"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDirect(item.directId!, item.noBukti)}
                                title="Hapus Transaksi Non-LPJ"
                                className="p-1.5 rounded-lg bg-natural-bg hover:bg-red-600 hover:text-white text-natural-secondary border border-natural-border transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {item.report && onSelectReport && (
                            <button
                              onClick={() => onSelectReport(item.report!)}
                              title="Buka LPJ / RAB Kegiatan"
                              className="p-1.5 rounded-lg bg-natural-bg hover:bg-natural-primary hover:text-white text-natural-secondary border border-natural-border transition-all"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {itemsWithRunningBalance.length > 0 && (
                <tfoot>
                  <tr className="bg-natural-bg/70 border-t-2 border-natural-primary/20 font-bold">
                    <td colSpan={8} className="py-4 px-6 text-right text-xs uppercase tracking-wider text-natural-primary">
                      Penerimaan &amp; Pengeluaran Periode Ini | Saldo Akhir Kas (Real):
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-sm text-emerald-700 whitespace-nowrap">
                      Rp {formatCurrency(totalInflow)}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-sm text-red-600 whitespace-nowrap">
                      Rp {formatCurrency(totalOutflow)}
                    </td>
                    <td className={`py-4 px-4 text-right font-mono text-sm whitespace-nowrap ${
                      realFinalBalance >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}>
                      Rp {formatCurrency(realFinalBalance)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Pindah Buku (Penerimaan) Saja */}
      {activeTab === 'pindah_buku_list' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-6 rounded-[28px] border border-natural-border shadow-xs">
            <div>
              <h3 className="font-serif italic text-2xl text-emerald-800">Transaksi Pindah Buku (Penerimaan Kas)</h3>
              <p className="text-natural-secondary text-xs mt-1">
                Pencatatan penarikan atau pemindahbukuan dari rekening bank (Bank Jateng / BSI / Kas Lain) masuk ke kas bendahara
              </p>
            </div>
            <button
              onClick={handleOpenAddPindahBuku}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              Tambah Pindah Buku
            </button>
          </div>

          <div className="bg-white rounded-[32px] border border-natural-border shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-natural-border bg-emerald-50/40 text-[10px] uppercase tracking-wider text-emerald-900 font-bold">
                    <th className="py-4 px-5 text-center w-12">No</th>
                    <th className="py-4 px-4 w-28">Tanggal</th>
                    <th className="py-4 px-4 w-32">No. Bukti / BKM</th>
                    <th className="py-4 px-4 w-40">Asal Rekening</th>
                    <th className="py-4 px-4 w-40">Pos Penerimaan</th>
                    <th className="py-4 px-6">Uraian Penerimaan</th>
                    <th className="py-4 px-4 w-36">Diserahkan Oleh</th>
                    <th className="py-4 px-6 text-right w-36">Jumlah (Rp)</th>
                    <th className="py-4 px-4 text-center w-28">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-natural-border/50">
                  {cashInflows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-14 text-center text-natural-secondary italic">
                        Belum ada catatan pindah buku penerimaan kas. Klik "+ Tambah Pindah Buku" di atas untuk mencatat.
                      </td>
                    </tr>
                  ) : (
                    cashInflows.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-natural-bg/30 transition-colors">
                        <td className="py-3 px-5 text-center font-mono text-[11px] text-natural-secondary">{idx + 1}</td>
                        <td className="py-3 px-4 font-mono text-[11px]">{formatDate(item.date, { dateStyle: 'medium' })}</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-800">{item.noBukti}</td>
                        <td className="py-3 px-4 font-medium">{item.sourceAccount}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px]">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-6">
                          <div className="font-medium text-natural-text">{item.description}</div>
                          {item.notes && <div className="text-[10px] text-natural-secondary italic">{item.notes}</div>}
                        </td>
                        <td className="py-3 px-4 text-natural-secondary">{item.receivedFrom || '-'}</td>
                        <td className="py-3 px-6 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          Rp {formatCurrency(item.amount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handlePrintVoucher({
                                id: `inf-print-${item.id}`,
                                itemType: 'inflow_pindah_buku',
                                inflowId: item.id,
                                activityName: 'Pindah Buku Bank',
                                unitName: 'Kas Utama Bendahara',
                                date: item.date,
                                approvalDate: item.date,
                                noBukti: item.noBukti,
                                category: item.category,
                                description: item.description,
                                partyName: item.sourceAccount || item.receivedFrom || 'Bank',
                                inflowAmount: item.amount,
                                outflowAmount: 0,
                                notes: item.notes,
                                detailOrder: 0,
                              })}
                              title="Cetak Bukti Kas Masuk"
                              className="p-1.5 rounded-lg bg-natural-bg hover:bg-emerald-700 hover:text-white text-natural-secondary border border-natural-border transition-all"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEditPindahBuku(item)}
                              title="Edit Transaksi"
                              className="p-1.5 rounded-lg bg-natural-bg hover:bg-emerald-600 hover:text-white text-natural-secondary border border-natural-border transition-all"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePindahBuku(item.id!, item.noBukti)}
                              title="Hapus Transaksi"
                              className="p-1.5 rounded-lg bg-natural-bg hover:bg-red-600 hover:text-white text-natural-secondary border border-natural-border transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Kas Keluar Non-LPJ Saja */}
      {activeTab === 'direct_list' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-6 rounded-[28px] border border-natural-border shadow-xs">
            <div>
              <h3 className="font-serif italic text-2xl text-natural-primary">Transaksi Kas Keluar Langsung (Non-LPJ)</h3>
              <p className="text-natural-secondary text-xs mt-1">
                Catatan pengeluaran kas rutin sekolah seperti listrik, air, internet, konsumsi harian, dan belanja darurat bendahara
              </p>
            </div>
            <button
              onClick={handleOpenAddDirect}
              className="bg-natural-primary text-white px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-natural-primary/90 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              Tambah Kas Keluar Non-LPJ
            </button>
          </div>

          <div className="bg-white rounded-[32px] border border-natural-border shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-natural-border bg-natural-bg/40 text-[10px] uppercase tracking-wider text-natural-secondary font-bold">
                    <th className="py-4 px-5 text-center w-12">No</th>
                    <th className="py-4 px-4 w-28">Tanggal</th>
                    <th className="py-4 px-4 w-32">No. Bukti / BKK</th>
                    <th className="py-4 px-4 w-40">Unit / Pihak</th>
                    <th className="py-4 px-4 w-40">Pos Belanja</th>
                    <th className="py-4 px-6">Uraian Belanja</th>
                    <th className="py-4 px-4 w-36">Penerima</th>
                    <th className="py-4 px-6 text-right w-36">Jumlah (Rp)</th>
                    <th className="py-4 px-4 text-center w-28">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-natural-border/50">
                  {directOutflows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-14 text-center text-natural-secondary italic">
                        Belum ada transaksi pengeluaran langsung non-LPJ. Klik tombol "Tambah Kas Keluar Non-LPJ" di atas untuk mencatat.
                      </td>
                    </tr>
                  ) : (
                    directOutflows.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-natural-bg/30 transition-colors">
                        <td className="py-3 px-5 text-center font-mono text-[11px] text-natural-secondary">{idx + 1}</td>
                        <td className="py-3 px-4 font-mono text-[11px]">{formatDate(item.date, { dateStyle: 'medium' })}</td>
                        <td className="py-3 px-4 font-mono font-bold text-natural-primary">{item.noBukti}</td>
                        <td className="py-3 px-4 font-medium">{item.unitName}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-natural-bg border border-natural-border text-[10px]">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-6">
                          <div className="font-medium text-natural-text">{item.description}</div>
                          {item.notes && <div className="text-[10px] text-natural-secondary italic">{item.notes}</div>}
                        </td>
                        <td className="py-3 px-4 text-natural-secondary">{item.employeeName || '-'}</td>
                        <td className="py-3 px-6 text-right font-mono font-bold text-natural-primary whitespace-nowrap">
                          Rp {formatCurrency(item.amount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handlePrintVoucher({
                                id: `dir-print-${item.id}`,
                                itemType: 'direct_outflow',
                                directId: item.id,
                                activityName: 'Pengeluaran Langsung Kas Sekolah',
                                unitName: item.unitName,
                                date: item.date,
                                approvalDate: item.date,
                                noBukti: item.noBukti,
                                category: item.category,
                                description: item.description,
                                partyName: item.employeeName || '-',
                                inflowAmount: 0,
                                outflowAmount: item.amount,
                                notes: item.notes,
                                detailOrder: 0,
                              })}
                              title="Cetak Kuitansi BKK"
                              className="p-1.5 rounded-lg bg-natural-bg hover:bg-natural-primary hover:text-white text-natural-secondary border border-natural-border transition-all"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEditDirect(item)}
                              title="Edit Transaksi"
                              className="p-1.5 rounded-lg bg-natural-bg hover:bg-natural-secondary hover:text-white text-natural-secondary border border-natural-border transition-all"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDirect(item.id!, item.noBukti)}
                              title="Hapus Transaksi"
                              className="p-1.5 rounded-lg bg-natural-bg hover:bg-red-600 hover:text-white text-natural-secondary border border-natural-border transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Input / Ubah Saldo Awal */}
      <AnimatePresence>
        {showSaldoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-[32px] p-8 border border-natural-border shadow-2xl relative"
            >
              <button
                onClick={() => setShowSaldoModal(false)}
                className="absolute right-6 top-6 p-2 rounded-full hover:bg-natural-bg text-natural-secondary"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-serif italic text-natural-primary">Input Saldo Awal Kas</h3>
                  <p className="text-xs text-natural-secondary">Tentukan modal kas sekolah awal periode pembukuan</p>
                </div>
              </div>

              <form onSubmit={handleSaveSaldoAwal} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-natural-secondary mb-1">
                    Nominal Saldo Awal (Rp):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={saldoInput}
                    onChange={(e) => setSaldoInput(e.target.value)}
                    placeholder="Contoh: 50000000 atau 50000000.50"
                    className="w-full px-4 py-3 bg-natural-bg/50 border border-natural-border rounded-2xl font-mono text-lg font-bold text-natural-primary focus:bg-white focus:outline-hidden focus:border-natural-primary"
                  />
                  <p className="text-[11px] text-natural-secondary italic mt-1">
                    Terbilang: {terbilang(saldoInput || 0)}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-natural-secondary mb-1">
                      Per Tanggal:
                    </label>
                    <input
                      type="date"
                      required
                      value={saldoDateInput}
                      onChange={(e) => setSaldoDateInput(e.target.value)}
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-2xl text-xs focus:bg-white focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-natural-secondary mb-1">
                      Keterangan / Buku:
                    </label>
                    <input
                      type="text"
                      value={saldoNotesInput}
                      onChange={(e) => setSaldoNotesInput(e.target.value)}
                      placeholder="Misal: Saldo Awal Kas 1 September"
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-2xl text-xs focus:bg-white focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-natural-bg border border-natural-border text-xs text-natural-secondary leading-relaxed">
                  <strong>Catatan Saldo Akhir:</strong> Saldo akhir kas dihitung otomatis: <em>Saldo Awal + Penerimaan - Pengeluaran</em>.
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-natural-border/60">
                  <button
                    type="button"
                    onClick={() => setShowSaldoModal(false)}
                    className="px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider text-natural-secondary hover:bg-natural-bg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingSaldo}
                    className="px-6 py-2.5 rounded-full bg-natural-primary text-white text-xs font-bold uppercase tracking-wider hover:bg-natural-primary/90 transition-all shadow-md disabled:opacity-50"
                  >
                    {savingSaldo ? 'Menyimpan...' : 'Simpan Saldo Awal'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 2: Tambah / Edit Pindah Buku (Penerimaan Kas) */}
      <AnimatePresence>
        {showPindahBukuModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-[36px] p-8 border border-natural-border shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setShowPindahBukuModal(false)}
                className="absolute right-6 top-6 p-2 rounded-full hover:bg-natural-bg text-natural-secondary"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <ArrowDownLeft className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-serif italic text-emerald-900">
                    {editingInflow ? 'Ubah Pindah Buku (Penerimaan)' : 'Tambah Pindah Buku (Penerimaan Kas)'}
                  </h3>
                  <p className="text-xs text-natural-secondary">
                    Pencatatan penarikan atau transfer masuk dari rekening bank / sumber dana ke kas tunai bendahara
                  </p>
                </div>
              </div>

              <form onSubmit={handleSavePindahBuku} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-secondary mb-1">
                      Tanggal Pindah Buku:
                    </label>
                    <input
                      type="date"
                      required
                      value={pindahBukuForm.date}
                      onChange={(e) => setPindahBukuForm({ ...pindahBukuForm, date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-xs focus:bg-white focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-secondary mb-1">
                      Nomor Bukti / BKM:
                    </label>
                    <input
                      type="text"
                      required
                      value={pindahBukuForm.noBukti}
                      onChange={(e) => setPindahBukuForm({ ...pindahBukuForm, noBukti: e.target.value })}
                      placeholder="Contoh: BKM/PB-001"
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl font-mono text-xs focus:bg-white focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-secondary mb-1">
                      Sumber / Asal Rekening Bank:
                    </label>
                    <input
                      type="text"
                      list="source-account-suggestions"
                      required
                      value={pindahBukuForm.sourceAccount}
                      onChange={(e) => setPindahBukuForm({ ...pindahBukuForm, sourceAccount: e.target.value })}
                      placeholder="Pilih atau ketik asal rekening..."
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-xs focus:bg-white focus:outline-hidden"
                    />
                    <datalist id="source-account-suggestions">
                      <option value="Bank Jateng" />
                      <option value="Bank BSI" />
                      <option value="Bank BPD Jawa Tengah" />
                      <option value="Kas Utama Sekolah" />
                      <option value="Majelis Dikdasmen" />
                      <option value="Rekening BOS" />
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-secondary mb-1">
                      Pos Penerimaan:
                    </label>
                    <input
                      type="text"
                      list="inflow-category-suggestions"
                      required
                      value={pindahBukuForm.category}
                      onChange={(e) => setPindahBukuForm({ ...pindahBukuForm, category: e.target.value })}
                      placeholder="Pilih atau ketik pos penerimaan..."
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-xs focus:bg-white focus:outline-hidden"
                    />
                    <datalist id="inflow-category-suggestions">
                      <option value="Pindah Buku Rekening Bank" />
                      <option value="Pencairan Kas Operasional" />
                      <option value="Penerimaan BOS" />
                      <option value="Penerimaan SPP &amp; Infaq" />
                      <option value="Setoran Tunai Kas" />
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-secondary mb-1">
                    Uraian Penerimaan Kas:
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={pindahBukuForm.description}
                    onChange={(e) => setPindahBukuForm({ ...pindahBukuForm, description: e.target.value })}
                    placeholder="Contoh: Penarikan pindah buku rekening Bank Jateng untuk dana operasional kas bendahara bulan September 2026"
                    className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-xs focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-secondary mb-1">
                      Nominal Penerimaan (Rp):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={pindahBukuForm.amount}
                      onChange={(e) => setPindahBukuForm({ ...pindahBukuForm, amount: e.target.value })}
                      placeholder="Contoh: 15000000 atau 15000000.75"
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl font-mono text-base font-bold text-emerald-800 focus:bg-white focus:outline-hidden"
                    />
                    <p className="text-[10px] text-natural-secondary italic mt-1 truncate">
                      {terbilang(pindahBukuForm.amount || 0)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-secondary mb-1">
                      Diserahkan Oleh / Penyetor:
                    </label>
                    <input
                      type="text"
                      value={pindahBukuForm.receivedFrom}
                      onChange={(e) => setPindahBukuForm({ ...pindahBukuForm, receivedFrom: e.target.value })}
                      placeholder="Contoh: Teller Bank Jateng / Bendahara"
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-xs focus:bg-white focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-secondary mb-1">
                    Catatan Tambahan (Opsional):
                  </label>
                  <input
                    type="text"
                    value={pindahBukuForm.notes}
                    onChange={(e) => setPindahBukuForm({ ...pindahBukuForm, notes: e.target.value })}
                    placeholder="Nomor slip setoran, cek bank, atau catatan khusus"
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-xs focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-natural-border/60">
                  <button
                    type="button"
                    onClick={() => setShowPindahBukuModal(false)}
                    className="px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider text-natural-secondary hover:bg-natural-bg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingPindahBuku}
                    className="px-6 py-2.5 rounded-full bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50"
                  >
                    {savingPindahBuku ? 'Menyimpan...' : editingInflow ? 'Perbarui Pindah Buku' : 'Simpan Pindah Buku'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 3: Tambah / Edit Transaksi Kas Keluar Non-LPJ */}
      <AnimatePresence>
        {showDirectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-[36px] p-8 border border-natural-border shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setShowDirectModal(false)}
                className="absolute right-6 top-6 p-2 rounded-full hover:bg-natural-bg text-natural-secondary"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-serif italic text-natural-primary">
                    {editingDirect ? 'Ubah Transaksi Kas (Non-LPJ)' : 'Tambah Transaksi Kas Keluar (Non-LPJ)'}
                  </h3>
                  <p className="text-xs text-natural-secondary">
                    Pencatatan pengeluaran kas langsung sekolah di luar format proposal LPJ kegiatan
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveDirect} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-secondary mb-1">
                      Tanggal Transaksi:
                    </label>
                    <input
                      type="date"
                      required
                      value={directForm.date}
                      onChange={(e) => setDirectForm({ ...directForm, date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-xs focus:bg-white focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-secondary mb-1">
                      Nomor Bukti / BKK:
                    </label>
                    <input
                      type="text"
                      required
                      value={directForm.noBukti}
                      onChange={(e) => setDirectForm({ ...directForm, noBukti: e.target.value })}
                      placeholder="Contoh: BKK/DIR-001"
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl font-mono text-xs focus:bg-white focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-secondary mb-1">
                      Unit Kerja / Penanggung Jawab:
                    </label>
                    <select
                      value={directForm.unitName}
                      onChange={(e) => setDirectForm({ ...directForm, unitName: e.target.value })}
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-xs focus:bg-white focus:outline-hidden"
                    >
                      <option value="Umum / Bendahara">Umum / Bendahara</option>
                      {units.map(u => (
                        <option key={u.id} value={u.name}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-secondary mb-1">
                      Pos / Kategori Belanja:
                    </label>
                    <input
                      type="text"
                      list="category-suggestions"
                      value={directForm.category}
                      onChange={(e) => setDirectForm({ ...directForm, category: e.target.value })}
                      placeholder="Pilih atau ketik kategori..."
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-xs focus:bg-white focus:outline-hidden"
                    />
                    <datalist id="category-suggestions">
                      <option value="Operasional Kas Sekolah" />
                      <option value="Langganan Listrik &amp; Air" />
                      <option value="Internet &amp; Telekomunikasi" />
                      <option value="Kebersihan &amp; Pemeliharaan" />
                      <option value="Konsumsi Harian &amp; Dapur" />
                      <option value="Alat Tulis Kantor (ATK)" />
                      <option value="Honor &amp; Lembur" />
                      <option value="Belanja Tak Terduga" />
                      {expenseTypes.map(t => (
                        <option key={t.id} value={t.name} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-secondary mb-1">
                    Uraian Pengeluaran Belanja:
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={directForm.description}
                    onChange={(e) => setDirectForm({ ...directForm, description: e.target.value })}
                    placeholder="Contoh: Pembayaran tagihan listrik PLN gedung barat bulan September 2026"
                    className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-xs focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-secondary mb-1">
                      Jumlah Uang / Nominal (Rp):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={directForm.amount}
                      onChange={(e) => setDirectForm({ ...directForm, amount: e.target.value })}
                      placeholder="Contoh: 1250000 atau 1250000.50"
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl font-mono text-base font-bold text-natural-primary focus:bg-white focus:outline-hidden"
                    />
                    <p className="text-[10px] text-natural-secondary italic mt-1 truncate">
                      {terbilang(directForm.amount || 0)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-secondary mb-1">
                      Penerima / Pihak Ketiga:
                    </label>
                    <input
                      type="text"
                      value={directForm.employeeName}
                      onChange={(e) => setDirectForm({ ...directForm, employeeName: e.target.value })}
                      placeholder="Contoh: Petugas Loket PLN / Pak Slamet"
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-xs focus:bg-white focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-secondary mb-1">
                    Catatan Tambahan (Opsional):
                  </label>
                  <input
                    type="text"
                    value={directForm.notes}
                    onChange={(e) => setDirectForm({ ...directForm, notes: e.target.value })}
                    placeholder="Keterangan pendukung, nomor faktur toko, dll"
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-xs focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-natural-border/60">
                  <button
                    type="button"
                    onClick={() => setShowDirectModal(false)}
                    className="px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider text-natural-secondary hover:bg-natural-bg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingDirect}
                    className="px-6 py-2.5 rounded-full bg-natural-primary text-white text-xs font-bold uppercase tracking-wider hover:bg-natural-primary/90 transition-all shadow-md disabled:opacity-50"
                  >
                    {savingDirect ? 'Menyimpan...' : editingDirect ? 'Perbarui Transaksi' : 'Simpan Transaksi'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
