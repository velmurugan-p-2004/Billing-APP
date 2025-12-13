import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Settings, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const Layout = () => {
    const { t } = useTranslation();

    const navItems = [
        { path: '/', icon: LayoutDashboard, label: t('dashboard') },
        { path: '/billing', icon: ShoppingCart, label: t('billing') },
        { path: '/inventory', icon: Package, label: t('inventory') },
        { path: '/history', icon: History, label: t('history') },
        { path: '/settings', icon: Settings, label: t('settings') },
    ];

    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isStandalone, setIsStandalone] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);

    useEffect(() => {
        // Check if installed
        const mq = window.matchMedia('(display-mode: standalone)');
        setIsStandalone(mq.matches);

        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
            }
        } else {
            // Fallback for when browser doesn't support prompt or already fired
            setShowInstructions(true);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
            {!isStandalone && (
                <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-md">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold">Install Seematti App</span>
                        <span className="text-xs text-blue-100">Add to home screen for better experience</span>
                    </div>
                    <button
                        onClick={handleInstallClick}
                        className="bg-white text-blue-600 text-xs font-bold px-3 py-1.5 rounded-full shadow hover:bg-blue-50 transition-colors"
                    >
                        Install
                    </button>
                </div>
            )}

            {showInstructions && (
                <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowInstructions(false)}>
                    <div className="bg-white text-slate-900 p-6 rounded-lg max-w-sm w-full shadow-xl animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-lg mb-2">Install Manually</h3>
                        <p className="text-sm text-slate-600 mb-4">
                            Your browser isn't allowing us to pop up the install prompt automatically right now.
                        </p>
                        <ol className="list-decimal list-inside text-sm space-y-2 mb-4 font-medium">
                            <li>Tap the browser menu <span className="font-bold text-xl leading-none">⋮</span></li>
                            <li>Select <span className="text-blue-600">"Add to Home Screen"</span> or <span className="text-blue-600">"Install App"</span></li>
                        </ol>
                        <button
                            onClick={() => setShowInstructions(false)}
                            className="w-full py-2 bg-slate-100 font-medium rounded hover:bg-slate-200"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            <main className="flex-1 pb-20 overflow-y-auto">
                <Outlet />
            </main>

            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 z-50 shadow-[0_-1px_3px_rgba(0,0,0,0.1)]">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            cn(
                                "flex flex-col items-center justify-center w-full h-full space-y-1 text-xs font-medium text-slate-500 transition-colors",
                                isActive ? "text-blue-600 bg-blue-50/50" : "hover:text-slate-900 hover:bg-slate-50"
                            )
                        }
                    >
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>
        </div>
    );
};

export default Layout;
