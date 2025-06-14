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
      setConnected(true);
      setConnectionStatus('connected');
      setReconnectAttempts(0);
    });

    socketIo.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server. Reason:', reason);
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
      
      // Try to rejoin game if we have stored game info
      const gameId = localStorage.getItem('gameId');
      const playerId = localStorage.getItem('playerId');
      const isHost = localStorage.getItem('isHost') === 'true';
      
      if (gameId && playerId) {
        console.log('🎮 Attempting to rejoin game after reconnection...');
        
        if (isHost) {
          // Host should recreate the game
          const gameCode = localStorage.getItem('gameCode');
          const hostNickname = localStorage.getItem('hostNickname');
          
          if (gameCode && hostNickname) {
            socketIo.emit('create-game', {
              gameId,
              gameCode,
              hostId: playerId,
              hostNickname
            }, (response: any) => {
              if (response.success) {
                console.log('✅ Host game recreated after reconnection');
              } else {
                console.log('❌ Failed to recreate host game:', response.error);
              }
            });
          }
        } else {
          // Player should reconnect to existing game
          socketIo.emit('reconnect-player', {
            gameId,
            playerId
          }, (response: any) => {
            if (response.success) {
              console.log('✅ Player reconnected to game');
            } else {
              console.log('❌ Failed to reconnect to game:', response.error);
              // Game might be gone, redirect to home
              setTimeout(() => {
                window.location.href = '/';
              }, 2000);
            }
          });
        }
      }
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
  }, []);

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