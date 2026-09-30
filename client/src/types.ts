export interface Worker {
  id: number;
  name: string;
  hourly_rate?: number;
  active: number; // 1 = active, 0 = inactive
  created_at: string;
  current_status?: 'in' | 'out' | null;
  last_timestamp?: string | null;
}

export interface AttendanceLog {
  id: number;
  worker_id: number;
  worker_name: string;
  worker_active?: number;
  type: 'in' | 'out';
  timestamp: string;
  edited_by_admin?: boolean;
}

export interface DayLogSummary {
  date: string;
  hours: number;
  incomplete: boolean;
  pairs?: Array<{
    checkIn: AttendanceLog;
    checkOut: AttendanceLog;
    hours: number;
  }>;
  logs?: AttendanceLog[];
}

export interface PayrollWorker {
  id: number;
  worker_id?: number;
  name: string;
  hourly_rate: number;
  total_hours: number;
  total_pay: number;
  incomplete_days_count: number;
  incomplete_days?: DayLogSummary[];
  days?: DayLogSummary[];
}

export interface LiveWorkerStatus {
  id: number;
  name: string;
  status: 'IN' | 'OUT' | 'NOT_SEEN_YET';
  latestTimestamp: string | null;
  firstCheckin: string | null;
}

export interface LiveStatusSummary {
  totalWorkers: number;
  currentlyIn: number;
  currentlyOut: number;
  notSeenYet: number;
}

export interface LiveStatusResponse {
  summary: LiveStatusSummary;
  workers: LiveWorkerStatus[];
}

export interface ScanResponse {
  success: boolean;
  logId: number;
  worker: {
    id: number;
    name: string;
  };
  action: 'in' | 'out';
  previousAction: 'in' | 'out' | null;
  timestamp: string;
  formattedTime: string;
  message: string;
}

export interface AdminStatusResponse {
  isAdmin: boolean;
}
