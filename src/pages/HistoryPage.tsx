import { useState } from 'react';
// import { useTranslation } from 'react-i18next';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { db, Bill } from '@/db/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, FileText, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HistoryPage = () => {
    // const { t } = useTranslation(); // Unused
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    const [selectedProfileId, setSelectedProfileId] = useState<number | null>(
        Number(localStorage.getItem('defaultProfileId')) || null
    );
    const profiles = useLiveQuery(() => db.profiles.toArray());

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const bills = useLiveQuery(
        () => {
            let collection = db.bills.orderBy('date').reverse();
            return collection.filter(bill => {
                const matchesProfile = selectedProfileId ? bill.profileId === selectedProfileId : true;
                const matchesSearch = !searchQuery ||
                    (bill.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        String(bill.billNo).includes(searchQuery));

                let matchesDate = true;
                if (startDate) {
                    matchesDate = matchesDate && new Date(bill.date) >= new Date(startDate);
                }
                if (endDate) {
                    // unexpected behavior fix: set end date to end of that day
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    matchesDate = matchesDate && new Date(bill.date) <= end;
                }

                return matchesProfile && matchesSearch && matchesDate;
            }).toArray();
        },
        [searchQuery, selectedProfileId, startDate, endDate]
    );

    const handlePrint = (bill: Bill) => {
        // Navigate to print page with the bill ID
        navigate('/print-bill', { state: { bill } });
    };

    return (
        <div className="p-4 space-y-4 pb-24 max-w-md mx-auto">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Bill History</h1>
                <select
                    className="border rounded p-1 text-sm bg-white w-40"
                    value={selectedProfileId || ''}
                    onChange={(e) => setSelectedProfileId(Number(e.target.value) || null)}
                >
                    <option value="">All Businesses</option>
                    {profiles?.map(p => (
                        <option key={p.id} value={p.id}>{p.businessName}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="text-[10px] text-gray-500 uppercase font-bold">From</label>
                        <Input
                            type="date"
                            className="h-8 text-sm"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] text-gray-500 uppercase font-bold">To</label>
                        <Input
                            type="date"
                            className="h-8 text-sm"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                        placeholder="Search by name or bill no..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-3">
                {bills?.map((bill) => (
                    <Card key={bill.id} className="overflow-hidden">
                        <CardContent className="p-3 flex justify-between items-center">
                            <div>
                                <div className="font-semibold flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-500" />
                                    Bill #{bill.billNo}
                                </div>
                                <div className="text-sm text-gray-600">
                                    {new Date(bill.date).toLocaleDateString()} - {new Date(bill.date).toLocaleTimeString()}
                                </div>
                                <div className="text-sm font-medium">
                                    {bill.customerName || 'Walk-in Customer'}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className="font-bold text-lg">₹{bill.totalAmount}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs px-2 py-1 bg-slate-100 rounded uppercase">
                                        {bill.paymentMode}
                                    </span>
                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handlePrint(bill)}>
                                        <Printer className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                                        onClick={() => navigate('/billing', { state: { editBill: bill } })}
                                    >
                                        Edit
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {bills?.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        No bills found
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryPage;
