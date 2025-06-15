'use client';

import { useState } from 'react';

interface DebugPanelProps {
  title: string;
  data: Record<string, any>;
  logs: string[];
}

export default function DebugPanel({ title, data, logs }: DebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="position-fixed bottom-0 start-0 m-3" style={{ zIndex: 1060, maxWidth: '400px' }}>
      <div className="card border-info">
        <div 
          className="card-header bg-info text-white d-flex justify-content-between align-items-center"
          style={{ cursor: 'pointer' }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h6 className="mb-0">🐛 {title}</h6>
          <i className={`bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-up'}`}></i>
        </div>
        
        {isExpanded && (
          <div className="card-body" style={{ fontSize: '0.8rem', maxHeight: '300px', overflowY: 'auto' }}>
            {/* Current State */}
            <div className="mb-3">
              <strong>Current State:</strong>
              <div className="bg-light p-2 rounded mt-1">
                {Object.entries(data).map(([key, value]) => (
                  <div key={key}>
                    <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Recent Events */}
            <div>
              <strong>Recent Events:</strong>
              <div className="bg-light p-2 rounded mt-1" style={{ fontFamily: 'monospace' }}>
                {logs.length === 0 ? (
                  <em>No events yet</em>
                ) : (
                  logs.slice(-10).map((log, index) => (
                    <div key={index} className="mb-1" style={{ fontSize: '0.7rem' }}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}