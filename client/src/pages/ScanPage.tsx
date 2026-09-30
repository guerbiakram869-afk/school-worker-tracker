import React, { useState, useEffect, useMemo } from 'react';
import { getActiveWorkers, scanWorker } from '../api';
import type { Worker, ScanResponse } from '../types';
import { Search, Clock, CheckCircle2, LogOut, LogIn, AlertCircle, X, RefreshCw } from 'lucide-react';

export const ScanPage: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<ScanResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live Clock updater
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch active workers
  const loadWorkers = async (showLoadingState = true) => {
    if (showLoadingState) setLoading(true);
    try {
      const data = await getActiveWorkers();
      setWorkers(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load workers list');
    } finally {
      if (showLoadingState) setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkers();
  }, []);

  // Auto-dismiss feedback banner after 6 seconds
  useEffect(() => {
    if (feedback || errorMessage) {
      const timer = setTimeout(() => {
        setFeedback(null);
        setErrorMessage(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [feedback, errorMessage]);

  // Handle worker name tap
  const handleWorkerTap = async (worker: Worker) => {
    if (submittingId) return; // Prevent double tap

    setSubmittingId(worker.id);
    setErrorMessage(null);

    try {
      const result = await scanWorker(worker.id);
      setFeedback(result);

      // Optimistically update the worker status in the list
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === worker.id
            ? {
                ...w,
                current_status: result.action,
                last_timestamp: result.timestamp,
              }
            : w
        )
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Error recording scan. Please try again.');
    } finally {
      setSubmittingId(null);
    }
  };

  // Filter workers by search query
  const filteredWorkers = useMemo(() => {
    if (!searchTerm.trim()) return workers;
    const query = searchTerm.toLowerCase();
    return workers.filter((w) => w.name.toLowerCase().includes(query));
  }, [workers, searchTerm]);

  return (
    <div className="scan-page">
      <header className="scan-header">
        <h1 className="scan-title">School Staff Attendance</h1>
        <p className="scan-subtitle">Tap your name below to Check In or Check Out</p>
        {currentTime && (
          <div className="clock-badge">
            <Clock size={15} />
            <span>{currentTime}</span>
          </div>
        )}
      </header>

      {/* Instant Feedback Alert Banner */}
      {feedback && (
        <div className={`feedback-banner ${feedback.action === 'in' ? 'in' : 'out'}`} role="alert">
          <div className="banner-content">
            <span className="banner-icon">
              {feedback.action === 'in' ? '✅' : '👋'}
            </span>
            <div>
              <div className="banner-text-title">
                {feedback.worker.name} — {feedback.action === 'in' ? 'Checked In' : 'Checked Out'}
              </div>
              <div className="banner-text-sub">
                Recorded at {feedback.formattedTime}. Have a great {feedback.action === 'in' ? 'day' : 'evening'}!
              </div>
            </div>
          </div>
          <button
            className="banner-dismiss"
            onClick={() => setFeedback(null)}
            title="Dismiss message"
            aria-label="Dismiss"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="feedback-banner error" role="alert">
          <div className="banner-content">
            <AlertCircle className="banner-icon" color="#b91c1c" />
            <div>
              <div className="banner-text-title">Attendance Error</div>
              <div className="banner-text-sub">{errorMessage}</div>
            </div>
          </div>
          <button
            className="banner-dismiss"
            onClick={() => setErrorMessage(null)}
            title="Dismiss error"
            aria-label="Dismiss"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Search Input for fast lookup */}
      <div className="search-box-container">
        <Search className="search-icon" size={20} />
        <input
          type="text"
          className="search-input"
          placeholder="Search by worker name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search worker name"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            style={{
              position: 'absolute',
              right: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Clear search"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Workers Tap Buttons Grid */}
      <div className="worker-grid" role="list">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 0.75rem' }} />
            <p>Loading worker directory...</p>
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#fff', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem' }}>
              {searchTerm ? `No workers found matching "${searchTerm}"` : 'No active workers configured.'}
            </p>
          </div>
        ) : (
          filteredWorkers.map((worker) => {
            const isSubmitting = submittingId === worker.id;
            const isCheckedIn = worker.current_status === 'in';
            const isCheckedOut = worker.current_status === 'out';

            return (
              <button
                key={worker.id}
                className={`worker-tap-button ${isCheckedIn ? 'status-in' : isCheckedOut ? 'status-out' : ''}`}
                onClick={() => handleWorkerTap(worker)}
                disabled={isSubmitting || submittingId !== null}
                aria-label={`Record attendance for ${worker.name}. Current status: ${isCheckedIn ? 'Checked In' : 'Checked Out'}`}
              >
                <div className="worker-info">
                  <span className="worker-name">{worker.name}</span>
                  <span className="worker-time-sub">
                    {isCheckedIn
                      ? 'Currently Checked IN • Tap to Check OUT'
                      : isCheckedOut
                      ? 'Currently Checked OUT • Tap to Check IN'
                      : 'Not checked in today • Tap to Check IN'}
                  </span>
                </div>

                <div className="worker-action-indicator">
                  {isSubmitting ? (
                    <span className="badge badge-neutral">
                      <RefreshCw size={14} className="animate-spin" />
                      Logging...
                    </span>
                  ) : isCheckedIn ? (
                    <span className="badge badge-in">
                      <CheckCircle2 size={14} />
                      IN
                    </span>
                  ) : isCheckedOut ? (
                    <span className="badge badge-out">
                      <LogOut size={14} />
                      OUT
                    </span>
                  ) : (
                    <span className="badge badge-neutral">
                      <LogIn size={14} />
                      CHECK IN
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Bottom Info Note */}
      <footer style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Single Entrance Scanner • No login required for workers
      </footer>
    </div>
  );
};
