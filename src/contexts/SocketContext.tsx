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
    const socketIo = io(process.env.NEXT_PUBLIC_SOCKET_URL || '', {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
    });

    socketIo.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    socketIo.on('disconnect', () => {
      console.log('Disconnected from server');
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