export enum ReportStatus {
  BUDGET_PROPOSAL = 'budget_proposal',
  BUDGET_APPROVED = 'budget_approved',
  REPORTING = 'reporting',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

export interface ExpenseDetail {
  date: string;
  description: string;
  amount: number;
  category?: string;
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
  submittedBy: string;
  treasurerNotes?: string;
  ketuaName?: string;
  ketuaJabatan?: string;
  bendaharaName?: string;
  bendaharaJabatan?: string;
  submissionDate?: string;
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
