'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
});

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Initialize socket connection
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    
    console.log('Connecting to Socket.IO server:', socketUrl);
    
    const socketIo = io(socketUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true,
    });

    socketIo.on('connect', () => {
      console.log('Connected to server:', socketUrl);
      setConnected(true);
    });

    socketIo.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    socketIo.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnected(false);
    });

    setSocket(socketIo);

    // Cleanup on unmount
    return () => {
      socketIo.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}