import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { db } from '@/db/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IndianRupee, Package, AlertTriangle, TrendingUp } from 'lucide-react';

const Dashboard = () => {
    const { t } = useTranslation();

    const [selectedProfileId, setSelectedProfileId] = useState<number | null>(
        Number(localStorage.getItem('defaultProfileId')) || null
    );
    const profiles = useLiveQuery(() => db.profiles.toArray());

    const items = useLiveQuery(() => db.items.toArray());
    const bills = useLiveQuery(() => db.bills.toArray());

    if (!items || !bills) return <div className="p-4">Loading stats...</div>;

    const activeItems = items.filter(i =>
        selectedProfileId ? (i.profileId === selectedProfileId || !i.profileId) : true
    );

    const activeBills = bills.filter(b =>
        selectedProfileId ? b.profileId === selectedProfileId : true
    );

    const today = new Date().toISOString().split('T')[0];
    const todaysBills = activeBills.filter(b => b.date.startsWith(today));

    const todaysSales = todaysBills.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalItems = activeItems.length;
    const lowStockItems = activeItems.filter(i => i.stock < (i.lowStockLimit || 5)).length; // Use item limit if exists

    return (
        <div className="p-4 bg-slate-50 min-h-screen pb-24">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">{t('dashboard')}</h1>
                <select
                    className="border rounded p-1 text-sm bg-white w-32"
                    value={selectedProfileId || ''}
                    onChange={(e) => setSelectedProfileId(Number(e.target.value) || null)}
                >
                    <option value="">All Business</option>
                    {profiles?.map(p => (
                        <option key={p.id} value={p.id}>{p.businessName}</option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <Card className="col-span-2 bg-blue-600 text-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center text-blue-100">
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Today's Sales
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">₹{todaysSales.toFixed(0)}</div>
                        <div className="text-xs text-blue-100 mt-1">{todaysBills.length} Bills today</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center text-gray-500">
                            <Package className="w-4 h-4 mr-2" />
                            Total Items
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalItems}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center text-gray-500">
                            <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
                            Low Stock
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{lowStockItems}</div>
                    </CardContent>
                </Card>
            </div>

            <h2 className="text-lg font-bold mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
                <a href="/billing" className="p-4 bg-white rounded-lg border shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-slate-50">
                    <div className="p-2 bg-green-100 rounded-full text-green-600">
                        <IndianRupee className="w-6 h-6" />
                    </div>
                    <span className="font-medium text-sm">New Bill</span>
                </a>
                <a href="/inventory" className="p-4 bg-white rounded-lg border shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-slate-50">
                    <div className="p-2 bg-orange-100 rounded-full text-orange-600">
                        <Package className="w-6 h-6" />
                    </div>
                    <span className="font-medium text-sm">Add Item</span>
                </a>
            </div>

            {lowStockItems > 0 && (
                <div className="mt-6">
                    <h3 className="font-semibold mb-2">Low Stock Alerts</h3>
                    <div className="bg-white rounded-lg border divide-y">
                        {activeItems.filter(i => i.stock < (i.lowStockLimit || 5)).slice(0, 5).map(item => (
                            <div key={item.id} className="p-3 flex justify-between text-sm">
                                <span>{item.name}</span>
                                <span className="font-bold text-red-500">{item.stock} left</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
