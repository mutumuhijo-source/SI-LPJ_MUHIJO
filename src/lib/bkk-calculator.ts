import { Report, ReportStatus, CashInflow, DirectCashOutflow, BkkSettings } from '../types';

export type JournalItemType = 
  | 'inflow_pindah_buku' 
  | 'lpj_allocation' 
  | 'lpj_detail' 
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

export const parseTransactionDate = (dateStr?: string | null): { year: number; month: number; day: number; iso: string } | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim().split('T')[0];
  if (!clean) return null;

  const ymd = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10);
    const day = parseInt(ymd[3], 10);
    const iso = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return { year, month, day, iso };
  }

  const dmy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const year = parseInt(dmy[3], 10);
    const month = parseInt(dmy[2], 10);
    const day = parseInt(dmy[1], 10);
    const iso = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return { year, month, day, iso };
  }

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

export const getBkkSettingsFromCache = (): { initialBalance: number; initialBalanceDate: string; notes?: string } => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = localStorage.getItem('bkk_settings_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          initialBalance: Number(parsed.initialBalance) || 0,
          initialBalanceDate: parsed.initialBalanceDate || '2026-09-01',
          notes: parsed.notes || 'Saldo Kas per 1 September 2026'
        };
      }
    } catch (e) {
      // ignore
    }
  }
  return { initialBalance: 0, initialBalanceDate: '2026-09-01', notes: 'Saldo Kas per 1 September 2026' };
};

export const getLastBkkEndingBalanceFromCache = (): number => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = localStorage.getItem('bkk_last_ending_balance');
      if (cached !== null) {
        const val = Number(cached);
        if (!isNaN(val)) return val;
      }
    } catch (e) {
      // ignore
    }
  }
  return 0;
};

export const isDateBeforeBukuKasStart = (dateStr?: string | null, initialBalanceDate?: string): boolean => {
  if (!dateStr) return false;
  const parsed = parseTransactionDate(dateStr);
  if (!parsed) return false;

  const initialDateStr = initialBalanceDate || '2026-09-01';
  const parsedInit = parseTransactionDate(initialDateStr);

  if (parsedInit) {
    if (parsed.iso < parsedInit.iso) return true;
    if (parsedInit.month === 9) {
      if (parsed.year < parsedInit.year) return true;
      if (parsed.year === parsedInit.year && parsed.month < 9) return true;
      if (parsedInit.year === 2025 && parsed.year === 2026 && parsed.month < 9) return true;
    }
  } else {
    if (parsed.iso < '2026-09-01') return true;
  }

  return false;
};

export const getReportingInstructionDate = (r: Report, initialBalanceDate?: string): string => {
  if (r.reportingInstructedDate) return r.reportingInstructedDate;
  if (r.reportingInstructedAt && typeof r.reportingInstructedAt.toDate === 'function') {
    return r.reportingInstructedAt.toDate().toISOString().split('T')[0];
  }
  if (r.details && r.details.length > 0) {
    const detailDates = r.details.map(d => d.date).filter(Boolean).sort();
    if (detailDates.length > 0 && detailDates[0]) {
      return detailDates[0];
    }
  }
  if (r.completedDate) return r.completedDate;
  if (r.completedAt && typeof r.completedAt.toDate === 'function') {
    return r.completedAt.toDate().toISOString().split('T')[0];
  }
  if (r.updatedAt && typeof r.updatedAt.toDate === 'function') {
    return r.updatedAt.toDate().toISOString().split('T')[0];
  }
  if (r.submissionDate) return r.submissionDate;
  return initialBalanceDate || '2026-09-01';
};

export const getEntryTimestamp = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.toDate === 'function') return val.toDate().getTime();
  if (val.seconds) return val.seconds * 1000 + (val.nanoseconds ? Math.floor(val.nanoseconds / 1000000) : 0);
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Membangun seluruh item jurnal Buku Kas secara lengkap dan presisi
 * Digunakan bersama oleh BukuKasKeluar, MemoBudgetPage, dan Ringkasan Dashboard
 */
export const generateAllJournalItems = (
  bkkSettings: { initialBalance: number; initialBalanceDate?: string },
  cashInflows: any[],
  directOutflows: any[],
  reports: Report[]
): UnifiedJournalItem[] => {
  const items: UnifiedJournalItem[] = [];
  const initDate = bkkSettings.initialBalanceDate || '2026-09-01';

  // 1. Process Pindah Buku (Penerimaan Kas)
  cashInflows.forEach((inflow, idx) => {
    const itemDate = inflow.date || initDate;
    if (isDateBeforeBukuKasStart(itemDate, initDate)) return;

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

  // 2. Process LPJ Reports
  reports.forEach((r, rIdx) => {
    const isInBudgetMenu = 
      r.status === ReportStatus.BUDGET_PROPOSAL ||
      r.status === ReportStatus.BUDGET_APPROVED ||
      r.status === ReportStatus.REJECTED ||
      (r.status === ReportStatus.REVISION && (!r.details || r.details.length === 0));

    if (isInBudgetMenu) return;

    const instructDate = getReportingInstructionDate(r, initDate);
    const reportTs = getEntryTimestamp(r.reportingInstructedAt || r.submittedAt || r.approvedAt || r.updatedAt) || (parseTransactionDate(instructDate) ? new Date(parseTransactionDate(instructDate)!.iso).getTime() : 0);

    const isReportApproved = r.status === ReportStatus.COMPLETED || r.status === ReportStatus.ARCHIVED;

    if (isReportApproved) {
      const hasDetails = r.details && r.details.length > 0;

      if (hasDetails) {
        const validDetails = (r.details || []).filter(d => !isDateBeforeBukuKasStart(d.date || instructDate, initDate));

        if (validDetails.length === 0) return;

        validDetails.forEach((d, idx) => {
          const detailDate = d.date || instructDate;
          const budgetItem = r.proposedDetails && d.proposedIndex !== undefined 
            ? r.proposedDetails[d.proposedIndex] 
            : null;
          const category = d.category || budgetItem?.category || 'Belanja Kegiatan';
          const amt = Number(d.amount) || 0;

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
            detailOrder: 10 + idx,
          });
        });

        const latestDetailDate = (validDetails.length > 0 && validDetails[validDetails.length - 1].date) 
          ? validDetails[validDetails.length - 1].date 
          : '';
        const closingDate = r.completedDate || latestDetailDate || instructDate;

        if (!isDateBeforeBukuKasStart(closingDate, initDate)) {
          const budgetAmount = Number(r.amountReceived) || 0;
          const totalReportSpent = (r.details || []).reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
          const diff = Math.round((budgetAmount - totalReportSpent) * 10000) / 10000;

          if (diff > 0) {
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
              detailOrder: 999999,
            });
          } else if (diff < 0) {
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
              inflowAmount: deficit,
              outflowAmount: 0,
              status: r.status,
              notes: 'Kekurangan realisasi dimasukkan di penerimaan untuk pengembalian/talangan oleh bendahara',
              report: r,
              detailOrder: 999999,
            });
          }
        }
      } else {
        if (!isDateBeforeBukuKasStart(instructDate, initDate)) {
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
      if (!isDateBeforeBukuKasStart(instructDate, initDate)) {
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

  // 3. Process Direct Cash Outflows
  directOutflows.forEach((item, idx) => {
    const itemDate = item.date || initDate;
    if (isDateBeforeBukuKasStart(itemDate, initDate)) return;

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
};

export interface CalculatedBkkSummary {
  realFinalBalance: number;
  realTotalInflow: number;
  realTotalOutflow: number;
  initialBalance: number;
  initialBalanceDate: string;
}

export const calculateFullBkkSummary = (
  bkkSettings: { initialBalance: number; initialBalanceDate?: string },
  cashInflows: any[],
  directOutflows: any[],
  reports: Report[]
): CalculatedBkkSummary => {
  const initDate = bkkSettings.initialBalanceDate || '2026-09-01';
  const allJournalItems = generateAllJournalItems(bkkSettings, cashInflows, directOutflows, reports);

  // Kumulatif seluruh transaksi kas valid sejak dimulainya Buku Kas (persis dengan BukuKasKeluar.tsx)
  const realTotalInflow = Math.round(
    allJournalItems
      .filter((item) => !isDateBeforeBukuKasStart(item.groupDate || item.date, initDate))
      .reduce((acc, item) => acc + item.inflowAmount, 0) * 10000
  ) / 10000;

  const realTotalOutflow = Math.round(
    allJournalItems
      .filter((item) => !isDateBeforeBukuKasStart(item.groupDate || item.date, initDate))
      .reduce((acc, item) => acc + item.outflowAmount, 0) * 10000
  ) / 10000;

  const init = Number(bkkSettings.initialBalance) || 0;
  const realFinalBalance = Math.round((init + realTotalInflow - realTotalOutflow) * 10000) / 10000;

  return {
    realFinalBalance,
    realTotalInflow,
    realTotalOutflow,
    initialBalance: init,
    initialBalanceDate: initDate,
  };
};

export const calculateBkkEndingBalance = (
  bkkSettings: { initialBalance: number; initialBalanceDate?: string },
  cashInflows: any[],
  directOutflows: any[],
  reports: Report[]
): number => {
  const summary = calculateFullBkkSummary(bkkSettings, cashInflows, directOutflows, reports);
  return summary.realFinalBalance;
};
