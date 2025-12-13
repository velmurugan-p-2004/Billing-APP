import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Info, Settings, History } from 'lucide-react';
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

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
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
