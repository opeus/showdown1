'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  attemptReconnection: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  connectionStatus: 'disconnected',
  attemptReconnection: () => {},
});

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const attemptReconnection = useCallback(() => {
    if (socket && !connected) {
      console.log('Manual reconnection attempt...');
      setConnectionStatus('reconnecting');
      socket.connect();
    }
  }, [socket, connected]);

  useEffect(() => {
    // Initialize socket connection
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    
    console.log('🔌 Initializing Socket.IO connection to:', socketUrl);
    setConnectionStatus('connecting');
    
    const socketIo = io(socketUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      timeout: 10000,
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      // Match server-side ping/pong settings
      upgrade: true,
      rememberUpgrade: true,
    });

    socketIo.on('connect', () => {
      console.log('✅ Connected to server:', socketUrl);
      console.log('✅ Socket ID:', socketIo.id);
      console.log('✅ Connection status will be set to connected');
      setConnected(true);
      setConnectionStatus('connected');
      setReconnectAttempts(0);
    });

    socketIo.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server. Reason:', reason);
      console.log('❌ Socket ID was:', socketIo.id);
      console.log('❌ Connection status will be set to disconnected');
      setConnected(false);
      setConnectionStatus('disconnected');
      
      // Attempt automatic reconnection for network issues
      if (reason === 'io server disconnect') {
        // Server disconnected, don't auto-reconnect
        console.log('Server disconnected us, not auto-reconnecting');
      } else {
        // Network issue or client disconnect, auto-reconnect
        console.log('Network issue detected, will auto-reconnect');
        setConnectionStatus('reconnecting');
      }
    });

    socketIo.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
      setConnected(true);
      setConnectionStatus('connected');
      setReconnectAttempts(0);
      
      // Game-specific reconnection logic is handled by individual pages
      console.log('🔄 Socket reconnected, pages will handle game rejoining');
    });

    socketIo.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
      setReconnectAttempts(attemptNumber);
      setConnectionStatus('reconnecting');
    });

    socketIo.on('reconnect_failed', () => {
      console.log('💥 Reconnection failed after maximum attempts');
      setConnectionStatus('disconnected');
    });

    socketIo.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      setConnected(false);
      if (connectionStatus !== 'reconnecting') {
        setConnectionStatus('disconnected');
      }
    });

    setSocket(socketIo);

    // Heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (socketIo.connected) {
        const timestamp = Date.now();
        socketIo.emit('heartbeat', { timestamp }, (response: any) => {
          // Heartbeat acknowledged
          const latency = Date.now() - timestamp;
          if (latency > 1000) {
            console.log(`⚠️ High latency detected: ${latency}ms`);
          }
        });
      }
    }, 10000); // Every 10 seconds for better connection monitoring

    // Cleanup on unmount
    return () => {
      clearInterval(heartbeatInterval);
      socketIo.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SocketContext.Provider value={{ 
      socket, 
      connected, 
      connectionStatus, 
      attemptReconnection 
    }}>
      {children}
    </SocketContext.Provider>
  );
}