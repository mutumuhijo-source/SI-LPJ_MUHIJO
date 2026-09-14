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
