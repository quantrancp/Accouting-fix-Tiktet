
export enum ErrorStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  FIXED = 'FIXED',
  REJECTED = 'REJECTED'
}

export enum ErrorPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum ErrorCategory {
  INVOICE = 'Hóa đơn',
  PAYMENT = 'Thanh toán',
  TAX = 'Thuế',
  LEDGER = 'Sổ cái',
  SYSTEM = 'Hệ thống',
  OTHER = 'Khác'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface AccountingError {
  id: string;
  title: string;
  description: string;
  category: ErrorCategory;
  priority: ErrorPriority;
  status: ErrorStatus;
  createdAt: number;
  reporter: string;
  amount?: number;
  voucherNo?: string;
  imageUrl?: string;
  aiSuggestion?: string;
  chatHistory?: ChatMessage[];
  msDynamicsId?: string; // ID đồng bộ từ Microsoft Dynamics
}

export interface AIAnalysisResponse {
  category: ErrorCategory;
  priority: ErrorPriority;
  suggestion: string;
  potentialImpact: string;
}

export interface DashboardStats {
  total: number;
  pending: number;
  processing: number;
  fixed: number;
}
