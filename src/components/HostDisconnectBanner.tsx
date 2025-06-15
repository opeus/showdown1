'use client';

import { useState, useEffect } from 'react';

interface HostDisconnectBannerProps {
  secondsRemaining: number;
  visible: boolean;
}

export default function HostDisconnectBanner({ secondsRemaining, visible }: HostDisconnectBannerProps) {
  if (!visible) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const getUrgencyClass = () => {
    if (secondsRemaining <= 10) return 'bg-danger';
    if (secondsRemaining <= 30) return 'bg-warning';
    return 'bg-warning bg-opacity-75';
  };

  return (
    <div className={`position-fixed top-0 start-0 end-0 ${getUrgencyClass()} text-white py-2 px-3 text-center`} 
         style={{ zIndex: 1040 }}>
      <div className="d-flex align-items-center justify-content-center">
        <i className="bi bi-exclamation-triangle me-2"></i>
        <span>Host disconnected - waiting for reconnection ({timeDisplay})</span>
        <i className="bi bi-hourglass-split ms-2" 
           style={{ animation: 'spin 2s linear infinite' }}></i>
      </div>
    </div>
  );
}