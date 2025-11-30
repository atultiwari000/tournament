'use client';
import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import QRScanner from 'qr-scanner';

export default function ScanQRClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [scannedRaw, setScannedRaw] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);
  const { user } = useAuth();

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
      }
    };
  }, []);

  const startCamera = async () => {
    setError(null);
    try {
      if (!videoRef.current) return;
      const scanner = new QRScanner(videoRef.current, (decoded: string) => {
        // stop on first scan
        scanner.stop();
        setScanning(false);
        handleScanValue(decoded);
      });
      scannerRef.current = scanner;
      await scanner.start();
      setScanning(true);
    } catch (e: any) {
      console.error(e);
      setError(String(e?.message || e));
    }
  };

  const stopCamera = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setError(null);
    try {
      const scanRes = await QRScanner.scanImage(file, { returnDetailedScanResult: true });
      if (!scanRes) throw new Error('No QR code found in image');
      // scanRes may be a string or an object { data, cornerPoints }
      const payload = typeof scanRes === 'string' ? scanRes : (scanRes as any).data || JSON.stringify(scanRes);
      handleScanValue(payload);
    } catch (e: any) {
      console.error(e);
      setError(String(e?.message || e));
    }
  };

  const handleScanValue = async (value: string) => {
    setResult(null);
    setError(null);
    setScannedRaw(typeof value === 'string' ? value : JSON.stringify(value));
    try {
      // send encrypted data to backend for verification
      // get id token from Auth context current user (from top-level `user`)
      let token = '';
      if (user) {
        token = await user.getIdToken();
      } else {
        // try fallback to localStorage
        token = localStorage.getItem('id_token') || '';
      }
      const res = await fetch('/api/invoices/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ qr: value }),
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (e) {
        // not json
      }
      if (!res.ok) {
        if (res.status === 401) {
          setError('Unauthorized — please login as a manager');
        } else if (json?.error) {
          setError(`Server: ${json.error}`);
        } else {
          setError(`Server responded ${res.status}: ${text}`);
        }
        return;
      }
      setResult(json ?? text);
    } catch (e: any) {
      console.error(e);
      setError(String(e?.message || e));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div>
          <video ref={videoRef} style={{ width: 360, height: 240, background: '#000' }} />
          <div style={{ marginTop: 8 }}>
            {!scanning ? (
              <button onClick={startCamera}>Start Camera</button>
            ) : (
              <button onClick={stopCamera}>Stop Camera</button>
            )}
          </div>
        </div>
        <div>
          <div>
            <label style={{ display: 'block' }}>
              Upload QR image
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleUpload(e.target.files ? e.target.files[0] : null)}
              />
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <strong>Result</strong>
            {error && <div style={{ color: 'red' }}>{error}</div>}
            {scannedRaw && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#444' }}>Scanned value (raw):</div>
                <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxWidth: 480 }}>{scannedRaw}</div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  Length: {scannedRaw.length} chars
                </div>
              </div>
            )}
            {result && (
              <pre style={{ whiteSpace: 'pre-wrap', maxWidth: 480 }}>{JSON.stringify(result, null, 2)}</pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
