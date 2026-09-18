import { Report, ReportStatus } from '../types';

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

export const getBkkSettingsFromCache = (): { initialBalance: number; initialBalanceDate: string } => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = localStorage.getItem('bkk_settings_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          initialBalance: Number(parsed.initialBalance) || 0,
          initialBalanceDate: parsed.initialBalanceDate || '2026-09-01'
        };
      }
    } catch (e) {
      // ignore
    }
  }
  return { initialBalance: 0, initialBalanceDate: '2026-09-01' };
};

export const isDateBeforeBukuKasStart = (dateStr: string | null | undefined, initialBalanceDate?: string): boolean => {
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

export const calculateBkkEndingBalance = (
  bkkSettings: { initialBalance: number; initialBalanceDate?: string },
  cashInflows: any[],
  directOutflows: any[],
  reports: Report[]
): number => {
  const initDate = bkkSettings.initialBalanceDate || '2026-09-01';
  let totalInflow = 0;
  let totalOutflow = 0;

  // 1. Cash Inflows (Pindah Buku)
  cashInflows.forEach((inflow) => {
    const itemDate = inflow.date || initDate;
    if (isDateBeforeBukuKasStart(itemDate, initDate)) return;
    totalInflow += Number(inflow.amount) || 0;
  });

  // 2. Reports (LPJ)
  reports.forEach((r) => {
    const isInBudgetMenu = 
      r.status === ReportStatus.BUDGET_PROPOSAL ||
      r.status === ReportStatus.BUDGET_APPROVED ||
      r.status === ReportStatus.REJECTED ||
      (r.status === ReportStatus.REVISION && (!r.details || r.details.length === 0));

    if (isInBudgetMenu) return;

    const instructDate = getReportingInstructionDate(r, initDate);
    const isReportApproved = r.status === ReportStatus.COMPLETED || r.status === ReportStatus.ARCHIVED;

    if (isReportApproved) {
      const hasDetails = r.details && r.details.length > 0;
      if (hasDetails) {
        const validDetails = (r.details || []).filter(d => !isDateBeforeBukuKasStart(d.date || instructDate, initDate));
        if (validDetails.length === 0) return;

        validDetails.forEach((d) => {
          totalOutflow += Number(d.amount) || 0;
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
            totalOutflow += diff;
          } else if (diff < 0) {
            totalInflow += Math.abs(diff);
          }
        }
      } else {
        if (!isDateBeforeBukuKasStart(instructDate, initDate)) {
          const amt = Number(r.amountReceived) || 0;
          if (amt > 0) totalOutflow += amt;
        }
      }
    } else {
      if (!isDateBeforeBukuKasStart(instructDate, initDate)) {
        const amt = Number(r.amountReceived) || 0;
        if (amt > 0) totalOutflow += amt;
      }
    }
  });

  // 3. Direct Outflows
  directOutflows.forEach((item) => {
    const itemDate = item.date || initDate;
    if (isDateBeforeBukuKasStart(itemDate, initDate)) return;
    totalOutflow += Number(item.amount) || 0;
  });

  const init = Number(bkkSettings.initialBalance) || 0;
  return Math.round((init + totalInflow - totalOutflow) * 10000) / 10000;
};
