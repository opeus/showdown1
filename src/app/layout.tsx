import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './globals.css';
import { SocketProvider } from '@/contexts/SocketContext';
import ConnectionStatus from '@/components/ConnectionStatus';

export const metadata = {
  title: 'Showdown v1.0',
  description: 'Multiplayer lobby system for Showdown card game',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-bs-theme="dark">
      <body>
        <SocketProvider>
          <div className="min-vh-100">
            {children}
          </div>
          <ConnectionStatus />
        </SocketProvider>
        <script 
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"
          async
        />
      </body>
    </html>
  );
}