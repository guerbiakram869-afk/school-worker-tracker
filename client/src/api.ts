import type {
  Worker,
  AttendanceLog,
  LiveStatusResponse,
  ScanResponse,
  AdminStatusResponse,
  PayrollWorker
} from './types';

const BASE_URL = '/api';

/**
 * Helper to perform fetch requests with error parsing
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Send cookies for admin authentication
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

// Public API
export async function getActiveWorkers(): Promise<Worker[]> {
  return request<Worker[]>('/workers');
}

export async function scanWorker(workerId: number): Promise<ScanResponse> {
  return request<ScanResponse>('/scan', {
    method: 'POST',
    body: JSON.stringify({ workerId }),
  });
}

// Admin Auth API
export async function checkAdminStatus(): Promise<AdminStatusResponse> {
  return request<AdminStatusResponse>('/admin/status');
}

export async function adminLogin(password: string): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function adminLogout(): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>('/admin/logout', {
    method: 'POST',
  });
}

// Admin Data API
export async function getLiveStatus(): Promise<LiveStatusResponse> {
  return request<LiveStatusResponse>('/admin/live-status');
}

export async function getAllWorkers(): Promise<Worker[]> {
  return request<Worker[]>('/workers?all=true');
}

export async function getLogs(params?: {
  workerId?: number;
  date?: string;
  startDate?: string;
  endDate?: string;
}): Promise<AttendanceLog[]> {
  const query = new URLSearchParams();
  if (params?.workerId) query.set('workerId', String(params.workerId));
  if (params?.date) query.set('date', params.date);
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);

  const qs = query.toString();
  return request<AttendanceLog[]>(`/admin/logs${qs ? `?${qs}` : ''}`);
}

export async function addWorker(name: string, hourly_rate?: number): Promise<Worker> {
  return request<Worker>('/workers', {
    method: 'POST',
    body: JSON.stringify({ name, hourly_rate }),
  });
}

export async function updateWorker(id: number, data: { name?: string; active?: boolean; hourly_rate?: number }): Promise<Worker> {
  return request<Worker>(`/workers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deactivateWorker(id: number): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/workers/${id}`, {
    method: 'DELETE',
  });
}

export async function getPayroll(month?: string): Promise<PayrollWorker[]> {
  const query = month ? `?month=${encodeURIComponent(month)}` : '';
  return request<PayrollWorker[]>(`/admin/payroll${query}`);
}

export async function createAdminLog(data: {
  worker_id: number;
  type: 'in' | 'out';
  timestamp?: string;
}): Promise<AttendanceLog> {
  return request<AttendanceLog>('/admin/logs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAdminLog(
  id: number,
  data: {
    timestamp?: string;
    type?: 'in' | 'out';
    checkout_timestamp?: string;
  }
): Promise<AttendanceLog> {
  return request<AttendanceLog>(`/admin/logs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function getExportCsvUrl(params?: { workerId?: number; startDate?: string; endDate?: string }): string {
  const query = new URLSearchParams();
  if (params?.workerId) query.set('workerId', String(params.workerId));
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);

  const qs = query.toString();
  return `${BASE_URL}/admin/export-csv${qs ? `?${qs}` : ''}`;
}
