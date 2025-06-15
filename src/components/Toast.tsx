'use client';

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, type, duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success': return 'bi-check-circle-fill';
      case 'warning': return 'bi-exclamation-triangle-fill';
      case 'danger': return 'bi-x-circle-fill';
      case 'info': return 'bi-info-circle-fill';
    }
  };

  const getBgClass = () => {
    switch (type) {
      case 'success': return 'bg-success';
      case 'warning': return 'bg-warning';
      case 'danger': return 'bg-danger';
      case 'info': return 'bg-info';
    }
  };

  return (
    <div 
      className={`toast show position-fixed bottom-0 end-0 m-3 ${getBgClass()} text-white`}
      style={{ zIndex: 1055 }}
      role="alert"
    >
      <div className="d-flex align-items-center p-3">
        <i className={`${getIcon()} me-2`}></i>
        <div className="me-auto">{message}</div>
        <button 
          type="button" 
          className="btn-close btn-close-white ms-3" 
          onClick={onClose}
        ></button>
      </div>
    </div>
  );
}