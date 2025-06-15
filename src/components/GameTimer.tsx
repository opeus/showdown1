'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '@/contexts/SocketContext';

interface GameTimerProps {
  gameId: string;
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
}

export default function GameTimer({ gameId, size = 'md', showProgress = false }: GameTimerProps) {
  const { socket } = useSocket();
  const [timer, setTimer] = useState<{
    remaining: number;
    total: number;
    active: boolean;
    type: 'risk' | 'showdown' | 'host-action';
  } | null>(null);

  useEffect(() => {
    if (!socket) return;

    // Listen for timer updates from server
    socket.on('timer-tick', (data) => {
      setTimer({
        remaining: data.remaining,
        total: data.total || 60,
        active: data.active,
        type: data.type || 'risk'
      });
    });

    socket.on('timer-expired', (data) => {
      setTimer(prev => prev ? { ...prev, remaining: 0, active: false } : null);
    });

    socket.on('round-started', (data) => {
      if (data.timer) {
        setTimer({
          remaining: data.timer.remaining,
          total: data.timer.total || 60,
          active: data.timer.active,
          type: data.timer.type || 'risk'
        });
      }
    });

    return () => {
      socket.off('timer-tick');
      socket.off('timer-expired');
      socket.off('round-started');
    };
  }, [socket]);

  if (!timer || !timer.active) {
    return null;
  }

  const getTimerColor = () => {
    const percentage = (timer.remaining / timer.total) * 100;
    if (percentage <= 15) return 'text-danger';
    if (percentage <= 40) return 'text-warning';
    return 'text-success';
  };

  const getProgressColor = () => {
    const percentage = (timer.remaining / timer.total) * 100;
    if (percentage <= 15) return 'bg-danger';
    if (percentage <= 40) return 'bg-warning';
    return 'bg-success';
  };

  const getTimerIcon = () => {
    switch (timer.type) {
      case 'risk':
        return 'bi-target';
      case 'showdown':
        return 'bi-eye';
      case 'host-action':
        return 'bi-gear';
      default:
        return 'bi-clock';
    }
  };

  const getTimerLabel = () => {
    switch (timer.type) {
      case 'risk':
        return 'Risk Submission';
      case 'showdown':
        return 'Showdown Response';
      case 'host-action':
        return 'Host Action';
      default:
        return 'Timer';
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm':
        return 'h6';
      case 'lg':
        return 'h2';
      default:
        return 'h4';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}`;
  };

  const progressPercentage = ((timer.total - timer.remaining) / timer.total) * 100;

  return (
    <div className="text-center">
      <div className={`${getSizeClass()} mb-1 ${getTimerColor()}`}>
        <i className={`bi ${getTimerIcon()} me-2`}></i>
        {formatTime(timer.remaining)}
      </div>
      <small className="text-muted d-block mb-2">
        {getTimerLabel()} Time
      </small>
      
      {showProgress && (
        <div className="progress" style={{ height: '4px' }}>
          <div 
            className={`progress-bar ${getProgressColor()}`}
            role="progressbar" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      )}
    </div>
  );
}