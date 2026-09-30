import React, { useState, useEffect } from 'react';
import {
  checkAdminStatus,
  adminLogin,
  adminLogout,
  getLiveStatus,
  getAllWorkers,
  getLogs,
  addWorker,
  updateWorker,
  deactivateWorker,
  getExportCsvUrl,
  getPayroll,
  createAdminLog,
  updateAdminLog,
} from '../api';
import type { Worker, AttendanceLog, LiveStatusResponse, PayrollWorker } from '../types';
import { QRPosterModal } from '../components/QRPosterModal';
import {
  LogOut,
  Users,
  Clock,
  Download,
  Plus,
  Edit2,
  UserX,
  UserCheck,
  RefreshCw,
  QrCode,
  Calendar,
  CheckCircle2,
  AlertCircle,
  X,
  Check,
  DollarSign,
  Wrench,
} from 'lucide-react';

export const AdminPage: React.FC = () => {
  // Auth state
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Active Tab: 'live' | 'logs' | 'payroll' | 'workers' | 'qr'
  const [activeTab, setActiveTab] = useState<'live' | 'logs' | 'payroll' | 'workers' | 'qr'>('live');

  // Live status data
  const [liveData, setLiveData] = useState<LiveStatusResponse | null>(null);
  const [loadingLive, setLoadingLive] = useState<boolean>(false);

  // Logs data
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [filterWorkerId, setFilterWorkerId] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');

  // Payroll data
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payrollData, setPayrollData] = useState<PayrollWorker[]>([]);
  const [loadingPayroll, setLoadingPayroll] = useState<boolean>(false);

  // Worker management data
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [workerNameInput, setWorkerNameInput] = useState<string>('');
  const [workerRateInput, setWorkerRateInput] = useState<string>('120');
  const [modalError, setModalError] = useState<string>('');

  // Fix time modal state
  const [showFixModal, setShowFixModal] = useState<boolean>(false);
  const [fixWorker, setFixWorker] = useState<{ id: number; name: string } | null>(null);
  const [fixDate, setFixDate] = useState<string>('');
  const [fixTime, setFixTime] = useState<string>('17:00');
  const [fixType, setFixType] = useState<'in' | 'out'>('out');
  const [fixLogId, setFixLogId] = useState<number | null>(null);
  const [fixError, setFixError] = useState<string>('');
  const [savingFix, setSavingFix] = useState<boolean>(false);

  // QR modal
  const [showQrModal, setShowQrModal] = useState<boolean>(false);

  // Status notification banner
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Verify auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      setCheckingAuth(true);
      try {
        const res = await checkAdminStatus();
        setIsAdmin(res.isAdmin);
      } catch {
        setIsAdmin(false);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  // When admin state changes or tab changes, load relevant data
  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === 'live') loadLiveStatus();
    if (activeTab === 'logs') loadLogs();
    if (activeTab === 'payroll') loadPayroll();
    if (activeTab === 'workers') loadWorkers();
  }, [isAdmin, activeTab, selectedMonth]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Auth actions
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setIsLoggingIn(true);
    setLoginError('');

    try {
      await adminLogin(password);
      setIsAdmin(true);
      setPassword('');
      showNotification('Logged in successfully');
    } catch (err: any) {
      setLoginError(err.message || 'Invalid administrator password');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await adminLogout();
      setIsAdmin(false);
      showNotification('Logged out successfully');
    } catch (err: any) {
      showNotification(err.message || 'Logout failed', 'error');
    }
  };

  // Data fetching
  const loadLiveStatus = async () => {
    setLoadingLive(true);
    try {
      const data = await getLiveStatus();
      setLiveData(data);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load live status', 'error');
    } finally {
      setLoadingLive(false);
    }
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await getLogs({
        workerId: filterWorkerId ? Number(filterWorkerId) : undefined,
        date: filterDate || undefined,
      });
      setLogs(data);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load logs', 'error');
    } finally {
      setLoadingLogs(false);
    }
  };

  const loadPayroll = async (monthToLoad?: string) => {
    setLoadingPayroll(true);
    try {
      const data = await getPayroll(monthToLoad || selectedMonth);
      setPayrollData(data);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load payroll data', 'error');
    } finally {
      setLoadingPayroll(false);
    }
  };

  const loadWorkers = async () => {
    setLoadingWorkers(true);
    try {
      const data = await getAllWorkers();
      setWorkers(data);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load workers', 'error');
    } finally {
      setLoadingWorkers(false);
    }
  };

  // Worker Management Actions
  const handleSaveWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerNameInput.trim()) {
      setModalError('Worker name cannot be empty');
      return;
    }

    const rateNum = parseFloat(workerRateInput);
    const hourlyRate = isNaN(rateNum) ? 120 : rateNum;

    try {
      if (editingWorker) {
        // Edit existing worker name and hourly rate
        await updateWorker(editingWorker.id, { name: workerNameInput.trim(), hourly_rate: hourlyRate });
        showNotification(`Worker "${workerNameInput.trim()}" updated successfully`);
      } else {
        // Add new worker
        await addWorker(workerNameInput.trim(), hourlyRate);
        showNotification(`Worker "${workerNameInput.trim()}" added successfully`);
      }
      setWorkerNameInput('');
      setWorkerRateInput('120');
      setEditingWorker(null);
      setShowAddModal(false);
      loadWorkers();
    } catch (err: any) {
      setModalError(err.message || 'Operation failed');
    }
  };

  // Payroll CSV Export Action
  const handleDownloadPayrollCsv = () => {
    if (!payrollData.length) {
      showNotification('No payroll data to export for this month', 'error');
      return;
    }
    const headers = ['Worker ID', 'Worker Name', 'Hourly Rate (da)', 'Hours Worked', 'Amount Due (da)', 'Incomplete Days'];
    const rows = payrollData.map((w) => [
      w.id,
      `"${w.name.replace(/"/g, '""')}"`,
      w.hourly_rate.toFixed(2),
      w.total_hours.toFixed(2),
      w.total_pay.toFixed(2),
      w.incomplete_days_count,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `payroll-${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Manual Time Correction Actions
  const handleOpenFixModal = (workerId: number, workerName: string, date: string, logId?: number) => {
    setFixWorker({ id: workerId, name: workerName });
    setFixDate(date);
    setFixTime('17:00');
    setFixLogId(logId || null);
    setFixType('out');
    setFixError('');
    setShowFixModal(true);
  };

  const handleSaveFixTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixWorker || !fixDate || !fixTime) {
      setFixError('Date and time are required');
      return;
    }
    setSavingFix(true);
    setFixError('');
    try {
      const timestamp = new Date(`${fixDate}T${fixTime}:00`).toISOString();
      if (fixLogId) {
        // Edit existing log
        await updateAdminLog(fixLogId, { timestamp, type: fixType });
        showNotification(`Log #${fixLogId} updated for ${fixWorker.name}`);
      } else {
        // Create new log (e.g. missing check-out)
        await createAdminLog({
          worker_id: fixWorker.id,
          type: fixType,
          timestamp,
        });
        showNotification(`Missing check-${fixType} time recorded for ${fixWorker.name} on ${fixDate}`);
      }
      setShowFixModal(false);
      // Refresh payroll and logs to reflect correction
      loadPayroll();
      loadLogs();
      loadLiveStatus();
    } catch (err: any) {
      setFixError(err.message || 'Failed to save time correction');
    } finally {
      setSavingFix(false);
    }
  };

  // Toggle active/inactive: Soft deactivation or reactivation (Never hard delete)
  const handleToggleActive = async (worker: Worker) => {
    try {
      if (worker.active) {
        // Deactivate
        await deactivateWorker(worker.id);
        showNotification(`Worker "${worker.name}" deactivated`);
      } else {
        // Reactivate
        await updateWorker(worker.id, { active: true });
        showNotification(`Worker "${worker.name}" reactivated`);
      }
      loadWorkers();
    } catch (err: any) {
      showNotification(err.message || 'Failed to update worker status', 'error');
    }
  };

  const handleDownloadCsv = () => {
    const url = getExportCsvUrl({
      workerId: filterWorkerId ? Number(filterWorkerId) : undefined,
      startDate: filterDate || undefined,
      endDate: filterDate || undefined,
    });
    window.location.href = url;
  };

  // Format date & time
  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Loading indicator for initial auth check
  if (checkingAuth) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 1rem', color: 'var(--text-muted)' }}>
        <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 1rem' }} />
        <p>Checking authentication status...</p>
      </div>
    );
  }

  // Login view if unauthenticated
  if (!isAdmin) {
    return (
      <div className="login-card">
        <img
          src="/logo.png"
          alt="مدرسة الياسمين - ELyassamine School"
          style={{ width: '76px', height: '76px', borderRadius: '50%', objectFit: 'cover', margin: '0 auto 1.25rem', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)', border: '2px solid rgba(0, 0, 0, 0.06)' }}
        />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          Administrator Access
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.75rem' }}>
          Enter the admin password to access live logs, manage workers, and export attendance records.
        </p>

        {loginError && (
          <div className="feedback-banner error" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
            <div className="banner-content">
              <AlertCircle size={18} color="#b91c1c" />
              <div className="banner-text-sub" style={{ color: '#991b1b', fontWeight: 600 }}>
                {loginError}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-pwd">
              Admin Password
            </label>
            <input
              id="admin-pwd"
              type="password"
              className="form-input"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem' }}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? 'Verifying...' : 'Sign In as Admin'}
          </button>
        </form>

      </div>
    );
  }

  // Admin Dashboard View
  return (
    <div>
      {/* Header */}
      <div className="admin-header">
        <div className="admin-title-group">
          <h1>Dashboard</h1>
          <p>Real-time school worker monitoring, historical logs, and staff directory</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => setShowQrModal(true)}>
            <QrCode size={16} />
            Entrance QR Code
          </button>
          <button className="btn btn-secondary" onClick={handleLogout} title="Log out of admin session">
            <LogOut size={16} />
            Log Out
          </button>
        </div>
      </div>

      {/* Global Notification Toast */}
      {notification && (
        <div
          className={`feedback-banner ${notification.type === 'success' ? 'in' : 'error'}`}
          style={{ marginBottom: '1.5rem' }}
        >
          <div className="banner-content">
            {notification.type === 'success' ? (
              <CheckCircle2 className="banner-icon" color="#166534" size={24} />
            ) : (
              <AlertCircle className="banner-icon" color="#991b1b" size={24} />
            )}
            <div className="banner-text-title">{notification.message}</div>
          </div>
          <button className="banner-dismiss" onClick={() => setNotification(null)}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'live' ? 'active' : ''}`}
          onClick={() => setActiveTab('live')}
        >
          <Clock size={17} />
          Who's In / Out Today
        </button>

        <button
          className={`admin-tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <Calendar size={17} />
          Attendance Logs & History
        </button>

        <button
          className={`admin-tab ${activeTab === 'payroll' ? 'active' : ''}`}
          onClick={() => setActiveTab('payroll')}
        >
          <DollarSign size={17} />
          Payroll
        </button>

        <button
          className={`admin-tab ${activeTab === 'workers' ? 'active' : ''}`}
          onClick={() => setActiveTab('workers')}
        >
          <Users size={17} />
          Manage Workers
        </button>
      </div>

      {/* TAB 1: Live Status */}
      {activeTab === 'live' && (
        <div>
          {/* Summary Stat Cards */}
          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-label">Total Active Workers</div>
              <div className="summary-value" style={{ color: 'var(--primary)' }}>
                {liveData?.summary.totalWorkers ?? 0}
              </div>
            </div>

            <div className="summary-card in">
              <div className="summary-label">Currently IN Right Now</div>
              <div className="summary-value">
                {liveData?.summary.currentlyIn ?? 0}
              </div>
            </div>

            <div className="summary-card out">
              <div className="summary-label">Stepped OUT / Left</div>
              <div className="summary-value">
                {liveData?.summary.currentlyOut ?? 0}
              </div>
            </div>

            <div className="summary-card not-seen">
              <div className="summary-label">Not Arrived Today</div>
              <div className="summary-value">
                {liveData?.summary.notSeenYet ?? 0}
              </div>
            </div>
          </div>

          {/* Real-time Workers Table */}
          <div className="table-card">
            <div className="table-header-bar">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Today's Live Attendance Status</h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={loadLiveStatus}
                disabled={loadingLive}
              >
                <RefreshCw size={14} className={loadingLive ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Worker Name</th>
                    <th>Current Status</th>
                    <th>First Check In Today</th>
                    <th>Latest Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingLive ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>
                        Loading live status...
                      </td>
                    </tr>
                  ) : !liveData?.workers.length ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No active workers found.
                      </td>
                    </tr>
                  ) : (
                    liveData.workers.map((worker) => (
                      <tr key={worker.id}>
                        <td style={{ fontWeight: 600 }}>{worker.name}</td>
                        <td>
                          {worker.status === 'IN' ? (
                            <span className="badge badge-in">
                              <CheckCircle2 size={12} /> IN
                            </span>
                          ) : worker.status === 'OUT' ? (
                            <span className="badge badge-out">
                              <LogOut size={12} /> OUT
                            </span>
                          ) : (
                            <span className="badge badge-neutral">Not Arrived</span>
                          )}
                        </td>
                        <td>{formatDateTime(worker.firstCheckin)}</td>
                        <td>{formatDateTime(worker.latestTimestamp)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Logs & History */}
      {activeTab === 'logs' && (
        <div className="table-card">
          <div className="table-header-bar">
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <input
                  type="date"
                  className="form-input"
                  style={{ padding: '0.4rem 0.65rem' }}
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </div>

              <div>
                <select
                  className="form-input"
                  style={{ padding: '0.4rem 0.65rem' }}
                  value={filterWorkerId}
                  onChange={(e) => setFilterWorkerId(e.target.value)}
                >
                  <option value="">All Workers</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <button className="btn btn-secondary btn-sm" onClick={loadLogs} disabled={loadingLogs}>
                <RefreshCw size={14} className={loadingLogs ? 'animate-spin' : ''} />
                Filter
              </button>
            </div>

            <button className="btn btn-primary btn-sm" onClick={handleDownloadCsv}>
              <Download size={14} />
              Export CSV
            </button>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Log ID</th>
                  <th>Worker Name</th>
                  <th>Action</th>
                  <th>Timestamp</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingLogs ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                      Loading logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No attendance records found for this filter.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>#{log.id}</td>
                      <td style={{ fontWeight: 600 }}>{log.worker_name}</td>
                      <td>
                        {log.type === 'in' ? (
                          <span className="badge badge-in">Check In</span>
                        ) : (
                          <span className="badge badge-out">Check Out</span>
                        )}
                      </td>
                      <td>{formatDateTime(log.timestamp)}</td>
                      <td>
                        {log.edited_by_admin ? (
                          <span className="badge badge-neutral" style={{ fontSize: '0.72rem', color: 'var(--primary)' }}>
                            <Wrench size={11} /> Admin Edited
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Scanned</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => handleOpenFixModal(log.worker_id, log.worker_name, log.timestamp.slice(0, 10), log.id)}
                          title="Edit timestamp or add missing check-out"
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: Payroll */}
      {activeTab === 'payroll' && (
        <div className="table-card">
          <div className="table-header-bar">
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>Month:</label>
                <input
                  type="month"
                  className="form-input"
                  style={{ padding: '0.4rem 0.65rem' }}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>

              <button className="btn btn-secondary btn-sm" onClick={() => loadPayroll()} disabled={loadingPayroll}>
                <RefreshCw size={14} className={loadingPayroll ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            <button
              className="btn btn-primary btn-sm"
              onClick={handleDownloadPayrollCsv}
              disabled={loadingPayroll || payrollData.length === 0}
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Worker Name</th>
                  <th>Hourly Rate</th>
                  <th>Hours Worked</th>
                  <th>Amount Due</th>
                  <th>Incomplete Days</th>
                </tr>
              </thead>
              <tbody>
                {loadingPayroll ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                      Calculating monthly payroll...
                    </td>
                  </tr>
                ) : payrollData.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No active workers found for this month.
                    </td>
                  </tr>
                ) : (
                  payrollData.map((worker) => (
                    <tr key={worker.id}>
                      <td style={{ fontWeight: 600 }}>{worker.name}</td>
                      <td>{worker.hourly_rate.toFixed(2)} da/hr</td>
                      <td style={{ fontWeight: 600 }}>{worker.total_hours.toFixed(2)} hrs</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {worker.total_pay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} da
                      </td>
                      <td>
                        {worker.incomplete_days_count === 0 ? (
                          <span className="badge badge-in">
                            <CheckCircle2 size={12} /> 0
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-start' }}>
                            <span
                              className="badge badge-out"
                              style={{ color: '#b91c1c', backgroundColor: '#fef2f2', borderColor: '#fca5a5' }}
                            >
                              <AlertCircle size={12} /> {worker.incomplete_days_count} incomplete
                            </span>
                            {worker.incomplete_days && worker.incomplete_days.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
                                {worker.incomplete_days.map((incDay) => (
                                  <div
                                    key={incDay.date}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                      fontSize: '0.8rem',
                                      background: '#fff5f5',
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '4px',
                                      border: '1px solid #fed7d7'
                                    }}
                                  >
                                    <span style={{ fontWeight: 600, color: '#991b1b' }}>{incDay.date}</span>
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      style={{
                                        padding: '0.15rem 0.45rem',
                                        fontSize: '0.75rem',
                                        color: '#b91c1c',
                                        borderColor: '#fca5a5',
                                        backgroundColor: '#fff'
                                      }}
                                      onClick={() => handleOpenFixModal(worker.id, worker.name, incDay.date)}
                                      title="Manually enter missing check-out time"
                                    >
                                      <Wrench size={11} style={{ marginRight: '0.2rem' }} /> Fix Time
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Manage Workers */}
      {activeTab === 'workers' && (
        <div className="table-card">
          <div className="table-header-bar">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>School Workers Directory</h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditingWorker(null);
                setWorkerNameInput('');
                setWorkerRateInput('120');
                setModalError('');
                setShowAddModal(true);
              }}
            >
              <Plus size={14} />
              Add Worker
            </button>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Worker Name</th>
                  <th>Hourly Rate</th>
                  <th>Status</th>
                  <th>Added On</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingWorkers ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                      Loading workers directory...
                    </td>
                  </tr>
                ) : workers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No workers found. Click "Add Worker" to create one.
                    </td>
                  </tr>
                ) : (
                  workers.map((worker) => (
                    <tr key={worker.id}>
                      <td style={{ fontWeight: 600 }}>{worker.name}</td>
                      <td>${(worker.hourly_rate !== undefined && worker.hourly_rate !== null ? Number(worker.hourly_rate) : 120).toFixed(2)}/hr</td>
                      <td>
                        {worker.active ? (
                          <span className="badge badge-in">Active</span>
                        ) : (
                          <span className="badge badge-neutral">Inactive (Deactivated)</span>
                        )}
                      </td>
                      <td>{formatDateTime(worker.created_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditingWorker(worker);
                              setWorkerNameInput(worker.name);
                              setWorkerRateInput(String(worker.hourly_rate !== undefined && worker.hourly_rate !== null ? worker.hourly_rate : 120));
                              setModalError('');
                              setShowAddModal(true);
                            }}
                            title="Edit worker"
                          >
                            <Edit2 size={13} />
                            Edit
                          </button>

                          {/* Toggle Active: Deactivate / Reactivate (Never Delete) */}
                          {worker.active ? (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleToggleActive(worker)}
                              title="Deactivate worker (preserves attendance logs)"
                            >
                              <UserX size={13} />
                              Deactivate
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleToggleActive(worker)}
                              style={{ color: 'var(--success)' }}
                              title="Reactivate worker"
                            >
                              <UserCheck size={13} />
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Worker Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                {editingWorker ? 'Edit Worker' : 'Add New Worker'}
              </h2>
              <button onClick={() => setShowAddModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div className="feedback-banner error" style={{ padding: '0.65rem 0.85rem', marginBottom: '1rem' }}>
                <span className="banner-text-sub" style={{ color: '#991b1b', fontWeight: 600 }}>
                  {modalError}
                </span>
              </div>
            )}

            <form onSubmit={handleSaveWorker}>
              <div className="form-group">
                <label className="form-label" htmlFor="w-name">
                  Full Name & Role
                </label>
                <input
                  id="w-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. John Doe (Custodian)"
                  value={workerNameInput}
                  onChange={(e) => setWorkerNameInput(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group" style={{ marginTop: '0.85rem' }}>
                <label className="form-label" htmlFor="w-rate">
                  Hourly Rate ($/hr)
                </label>
                <input
                  id="w-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  placeholder="120"
                  value={workerRateInput}
                  onChange={(e) => setWorkerRateInput(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Check size={16} />
                  {editingWorker ? 'Save Changes' : 'Add Worker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fix Time / Manual Correction Modal */}
      {showFixModal && fixWorker && (
        <div className="modal-overlay" onClick={() => setShowFixModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                {fixLogId ? 'Edit Attendance Time' : 'Fix Missing Check-Out'}
              </h2>
              <button onClick={() => setShowFixModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-main)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Worker</div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{fixWorker.name}</div>
            </div>

            {fixError && (
              <div className="feedback-banner error" style={{ padding: '0.65rem 0.85rem', marginBottom: '1rem' }}>
                <span className="banner-text-sub" style={{ color: '#991b1b', fontWeight: 600 }}>
                  {fixError}
                </span>
              </div>
            )}

            <form onSubmit={handleSaveFixTime}>
              <div className="form-group">
                <label className="form-label" htmlFor="fix-date">
                  Date
                </label>
                <input
                  id="fix-date"
                  type="date"
                  className="form-input"
                  value={fixDate}
                  onChange={(e) => setFixDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginTop: '0.85rem' }}>
                <label className="form-label" htmlFor="fix-type">
                  Log Type
                </label>
                <select
                  id="fix-type"
                  className="form-input"
                  value={fixType}
                  onChange={(e) => setFixType(e.target.value as 'in' | 'out')}
                >
                  <option value="out">Check Out (Missing Check-Out)</option>
                  <option value="in">Check In</option>
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '0.85rem' }}>
                <label className="form-label" htmlFor="fix-time">
                  Time (HH:MM)
                </label>
                <input
                  id="fix-time"
                  type="time"
                  className="form-input"
                  value={fixTime}
                  onChange={(e) => setFixTime(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowFixModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingFix}>
                  <Check size={16} />
                  {savingFix ? 'Saving...' : 'Save Time'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable QR Code Modal */}
      <QRPosterModal isOpen={showQrModal} onClose={() => setShowQrModal(false)} />
    </div>
  );
};
