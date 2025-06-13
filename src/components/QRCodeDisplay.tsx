'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
}

export default function QRCodeDisplay({ value, size = 200 }: QRCodeDisplayProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const generateQR = async () => {
      try {
        setLoading(true);
        const url = await QRCode.toDataURL(value, {
          width: size,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
        setQrCodeUrl(url);
        setError('');
      } catch (err) {
        console.error('Error generating QR code:', err);
        setError('Failed to generate QR code');
      } finally {
        setLoading(false);
      }
    };

    if (value) {
      generateQR();
    }
  }, [value, size]);

  if (loading) {
    return (
      <div className="qr-code-container d-flex align-items-center justify-content-center" style={{ width: size, height: size }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading QR code...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="qr-code-container d-flex align-items-center justify-content-center text-danger" style={{ width: size, height: size }}>
        <div className="text-center">
          <i className="bi bi-exclamation-triangle fs-1"></i>
          <div className="small mt-2">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="qr-code-container">
      <img src={qrCodeUrl} alt="QR Code" className="img-fluid" />
    </div>
  );
}