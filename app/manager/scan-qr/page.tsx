import ScanQRClient from './ScanQRClient';

export const metadata = {
  title: 'Scan QR',
};

export default function Page() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Scan QR</h1>
      <ScanQRClient />
    </div>
  );
}
