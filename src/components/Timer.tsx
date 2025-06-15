'use client';

import { useState, useEffect } from 'react';

interface TimerProps {
  seconds: number;
  type?: 'risk' | 'showdown' | 'host-action';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  onExpire?: () => void;
}

export default function Timer({ 
  seconds, 
  type = 'risk', 
  size = 'md', 
  showLabel = true,
  onExpire 
}: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    setTimeLeft(seconds);
  }, [seconds]);

  // Auto countdown for demo purposes (real countdown comes from server via socket)
  useEffect(() => {
    if (timeLeft <= 0) {
      onExpire?.();
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, onExpire]);

  const getTimerColor = () => {
    if (timeLeft <= 10) return 'text-danger';
    if (timeLeft <= 30) return 'text-warning';
    return 'text-success';
  };

  const getTimerIcon = () => {
    switch (type) {
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
    switch (type) {
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

  return (
    <div className="text-center">
      <div className={`${getSizeClass()} mb-1 ${getTimerColor()}`}>
        <i className={`bi ${getTimerIcon()} me-2`}></i>
        {formatTime(timeLeft)}
      </div>
      {showLabel && (
        <small className="text-muted d-block">
          {getTimerLabel()} Time
        </small>
      )}
    </div>
  );
}