export enum ReportStatus {
  BUDGET_PROPOSAL = 'budget_proposal',
  BUDGET_APPROVED = 'budget_approved',
  REPORTING = 'reporting',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
  REJECTED = 'rejected',
  REVISION = 'revision',
  INCOMPLETE = 'incomplete',
}

export interface ExpenseDetail {
  noBukti?: string;
  date?: string;
  description: string;
  amount: number;
  category?: string;
  proposedIndex?: number;
  employeeId?: string;
  employeeName?: string;
}

export interface DBUser {
  id?: string;
  username: string;
  pass: string;
  role: 'admin' | 'user';
  displayName: string;
  unitName: string;
}

export interface Employee {
  id?: string;
  name: string;
}

export interface ExpenseType {
  id?: string;
  name: string;
}

export interface Report {
  id?: string;
  unitId: string;
  unitName: string;
  activityName: string;
  amountReceived: number;
  totalSpent: number;
  details: ExpenseDetail[];
  proposedDetails?: ExpenseDetail[];
  status: ReportStatus;
  submittedAt: any;
  updatedAt?: any;
  approvedAt?: any;
  approvalDate?: string;
  reportingInstructedAt?: any;
  reportingInstructedDate?: string;
  completedAt?: any;
  completedDate?: string;
  submittedBy: string;
  treasurerNotes?: string;
  ketuaName?: string;
  ketuaJabatan?: string;
  bendaharaName?: string;
  bendaharaJabatan?: string;
  submissionDate?: string;
  parentReportId?: string;
  whatsappNumber?: string;
  whatsappVerified?: boolean;
  whatsappVerifiedAt?: string;
  includeWakaSignature?: boolean;
  wakaName?: string;
  wakaJabatan?: string;
}

export interface WhatsappSettings {
  fonnteToken: string;
  enabled: boolean;
  senderName?: string;
  schoolName?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface CashInflow {
  id?: string;
  date: string;
  noBukti: string;
  sourceAccount: string;
  category: string;
  description: string;
  amount: number;
  receivedFrom?: string;
  notes?: string;
  createdAt?: any;
  createdBy?: string;
}

export interface DirectCashOutflow {
  id?: string;
  date: string;
  noBukti: string;
  unitName: string;
  category: string;
  description: string;
  amount: number;
  employeeName?: string;
  notes?: string;
  createdAt?: any;
  createdBy?: string;
}

export interface BkkSettings {
  initialBalance: number;
  initialBalanceDate: string;
  notes?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface SchoolSettings {
  schoolName: string;
  schoolLogo?: string;
  memoHeaderUrl?: string;
  kopHeaderUrl?: string;
  principalName: string;
  principalNbm: string;
  treasurerName: string;
  treasurerNbm?: string;
  schoolAddress?: string;
  
  // Signatories for Weekly Budget Memos
  memoCity?: string;
  memoApproverName?: string;
  memoApproverNbm?: string;
  memoCheckerName?: string;
  memoCheckerNbm?: string;
  memoMakerName?: string;
  memoMakerNbm?: string;

  updatedAt?: any;
  updatedBy?: string;
}

export interface BudgetMemoItem {
  id?: string;
  reportId?: string;
  activityName: string;
  amount: number;
  isCustom?: boolean;
}

export interface BudgetMemo {
  id?: string;
  week: string; // e.g. "MINGGU 2"
  month: string; // e.g. "SEPTEMBER"
  year: string; // e.g. "2026"
  schoolName: string;
  
  operationalAccountName: string; // e.g. "BANK BTM KOMITE (5.02.00097)"
  operationalBalance: number; // e.g. 7269094
  
  transferAccountName: string; // e.g. "PEMASUKAN (5.02.00716)"
  transferAmount: number; // calculated sum of items
  
  totalBalanceAfter: number; // operationalBalance + transferAmount
  
  items: BudgetMemoItem[];

  memoDate: string; // e.g. "14 September 2026"
  memoCity: string; // e.g. "Ngadirejo"
  
  approverTitle?: string; // "Disetujui Oleh,"
  approverName: string;
  approverNbm: string;
  
  checkerTitle?: string; // "Diperiksa Oleh,"
  checkerName: string;
  checkerNbm: string;
  
  makerTitle?: string; // "Dibuat Oleh,"
  makerName: string;
  makerNbm: string;

  isPosted?: boolean;
  postedAt?: any;
  postedBy?: string;
  cashInflowId?: string;

  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
}

export interface CashDenomination {
  nominal: number;
  type: 'kertas' | 'logam';
  quantity: number;
  subtotal: number;
}

export interface CashMemorial {
  id?: string;
  month: string; // e.g. "APRIL"
  year: string; // e.g. "2026"
  date: string; // e.g. "17 April 2026"
  city: string; // e.g. "Ngadirejo"
  
  // Persetujuan Pengisian Kembali Kas Tunai
  initialBalance: number; // Saldo Awal (Plafon Kas)
  totalExpense: number; // Total Pengeluaran Kas Tunai
  remainingBalance: number; // Sisa Saldo Kas Tunai
  replenishmentAmount: number; // Jumlah Pengisian Kembali
  
  // Berita Acara Perhitungan Uang Kas (Kas Opname)
  countDate?: string; // Tanggal Fisik Kas Dihitung
  paperNotes: CashDenomination[]; // Rincian Uang Kertas
  coins: CashDenomination[]; // Rincian Uang Logam
  totalPaperAmount: number;
  totalCoinAmount: number;
  totalPhysicalCash: number;
  differenceNote?: string;

  // Pejabat Penandatangan
  approverDate?: string; // Disetujui Tanggal
  approverName: string; // Kepala Sekolah
  approverNbm: string;
  
  checkerName: string; // Diperiksa Oleh
  checkerNbm: string;
  
  makerName: string; // Dibuat Oleh / Bendahara kas tunai
  makerNbm: string;

  // Posting to Buku Kas (Pengeluaran Kas Tunai / Pengisian Kembali)
  isPosted?: boolean;
  postedAt?: any;
  postedBy?: string;
  cashOutflowId?: string;
  
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
}

export interface Unit {
  id: string;
  name: string;
  headName?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}
