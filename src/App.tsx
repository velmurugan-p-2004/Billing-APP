import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Settings from './pages/Settings';
import PrintBill from './pages/PrintBill';
import Inventory from './pages/Inventory';
import Billing from './pages/Billing';
import Dashboard from './pages/Dashboard';
import HistoryPage from './pages/HistoryPage';
import { InstallPWA } from './components/InstallPWA';
import { WifiOff } from 'lucide-react';

function App() {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <BrowserRouter>
            {isOffline && (
                <div className="bg-red-500 text-white text-xs text-center p-1 fixed top-0 w-full z-50 flex justify-center items-center gap-2">
                    <WifiOff className="w-3 h-3" />
                    <span>You are offline. App working in offline mode.</span>
                </div>
            )}
            <InstallPWA />
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="billing" element={<Billing />} />
                    <Route path="inventory" element={<Inventory />} />
                    <Route path="history" element={<HistoryPage />} />
                    <Route path="settings" element={<Settings />} />
                </Route>
                <Route path="/print/:id" element={<PrintBill />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
