export enum ReportStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface ExpenseDetail {
  description: string;
  amount: number;
}

export interface Report {
  id?: string;
  unitId: string;
  unitName: string;
  activityName: string;
  executionDate: string;
  amountReceived: number;
  totalSpent: number;
  details: ExpenseDetail[];
  status: ReportStatus;
  submittedAt: any;
  submittedBy: string;
  treasurerNotes?: string;
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
