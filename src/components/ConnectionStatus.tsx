'use client';

import { useSocket } from '@/contexts/SocketContext';

export default function ConnectionStatus() {
  const { connected, connectionStatus, attemptReconnection } = useSocket();

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'reconnecting':
        return '🔄';
      case 'disconnected':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  const getStatusClass = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-success';
      case 'connecting':
        return 'text-warning';
      case 'reconnecting':
        return 'text-info';
      case 'disconnected':
        return 'text-danger';
      default:
        return 'text-muted';
    }
  };

  if (connectionStatus === 'connected') {
    return null; // Don't show when everything is working
  }

  return (
    <div className="position-fixed bottom-0 start-50 translate-middle-x mb-3" style={{ zIndex: 1050 }}>
      <div className={`alert alert-${connectionStatus === 'disconnected' ? 'danger' : 'warning'} d-flex align-items-center shadow`}>
        <span className="me-2" style={{ fontSize: '1.2em' }}>
          {getStatusIcon()}
        </span>
        <div className="flex-grow-1">
          <strong className={getStatusClass()}>{getStatusText()}</strong>
          {connectionStatus === 'disconnected' && (
            <div className="mt-1">
              <small className="text-muted d-block">
                Check your internet connection
              </small>
              <button 
                className="btn btn-sm btn-outline-primary mt-2"
                onClick={attemptReconnection}
              >
                <i className="bi bi-arrow-clockwise me-1"></i>
                Try Again
              </button>
            </div>
          )}
          {connectionStatus === 'reconnecting' && (
            <div className="mt-1">
              <small className="text-muted">
                Attempting to reconnect...
              </small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}