import { useState } from 'react';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { db, Party } from '@/db/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, User, Edit, Phone, FileText, Trash2, Printer } from 'lucide-react';

const PartiesPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [currentParty, setCurrentParty] = useState<Partial<Party>>({});
    const [selectedPartyForHistory, setSelectedPartyForHistory] = useState<number | null>(null);
    const [selectedProfileId, setSelectedProfileId] = useState<number | null>(() => {
        const saved = localStorage.getItem('defaultProfileId');
        return saved ? Number(saved) : null;
    });

    const parties = useLiveQuery(
        () => {
            let collection = db.parties.orderBy('name');
            // Filter by profile
            collection = collection.filter(p => !selectedProfileId || p.profileId === selectedProfileId);

            if (searchQuery) {
                return collection.filter(party =>
                    party.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    party.mobile.includes(searchQuery)
                ).toArray();
            }
            return collection.toArray();
        },
        [searchQuery, selectedProfileId]
    );

    const profiles = useLiveQuery(() => db.profiles.toArray());

    const history = useLiveQuery(() =>
        selectedPartyForHistory ? db.partyTransactions.where('partyId').equals(selectedPartyForHistory).reverse().sortBy('date') : []
        , [selectedPartyForHistory]);

    const handleSave = async () => {
        if (!currentParty.name || !currentParty.mobile) {
            alert("Name and Mobile are required");
            return;
        }

        const partyData: Party = {
            name: currentParty.name,
            mobile: currentParty.mobile,
            aadhar: currentParty.aadhar || '',
            balance: currentParty.balance || 0,
            profileId: currentParty.profileId
        };

        try {
            if (currentParty.id) {
                await db.parties.update(currentParty.id, partyData);
            } else {
                await db.parties.add(partyData);
            }
            setIsEditing(false);
            setCurrentParty({});
        } catch (error) {
            console.error("Failed to save party", error);
            alert("Error saving party");
        }
    };

    const handleEdit = (party: Party) => {
        setCurrentParty(party);
        setIsEditing(true);
    };

    const handleDeleteParty = async (partyId: number) => {
        if (confirm('Are you sure you want to delete this party? This action cannot be undone.')) {
            await db.parties.delete(partyId);
        }
    };

    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [transactionAmount, setTransactionAmount] = useState('');
    const [transactionType, setTransactionType] = useState<'payment' | 'charge'>('payment');
    const [selectedPartyForTransaction, setSelectedPartyForTransaction] = useState<Party | null>(null);
    const [isPrinting, setIsPrinting] = useState<number | null>(null);

    const handlePrintPartyBalance = async (party: Party) => {
        setIsPrinting(party.id!);
        try {
            const { BluetoothService } = await import('@/utils/BluetoothService');
            const { EscPos } = await import('@/utils/EscPos');

            // Ensure printer is connected
            const isConnected = await BluetoothService.isConnected();
            if (!isConnected) {
                const autoConnected = await BluetoothService.autoConnect();
                if (!autoConnected) {
                    alert('Printer not connected. Please pair a printer first.');
                    setIsPrinting(null);
                    return;
                }
            }

            const encoder = new EscPos();
            const paperWidth = localStorage.getItem('printerPaperSize') || '58mm';
            const maxChars = paperWidth === '80mm' ? 48 : 32;

            // Get font settings
            const headerFontSize = localStorage.getItem('headerFontSize') || 'normal';
            const itemsFontSize = localStorage.getItem('itemsFontSize') || 'normal';
            const footerFontSize = localStorage.getItem('footerFontSize') || 'normal';
            const boldHeader = localStorage.getItem('boldHeader') !== 'false';
            const boldItems = localStorage.getItem('boldItems') === 'true';
            const boldFooter = localStorage.getItem('boldFooter') === 'true';

            // Get profile
            const profiles = await db.profiles.toArray();
            const businessProfile = selectedProfileId 
                ? profiles.find(p => p.id === selectedProfileId) || profiles[0]
                : profiles[0];
            
            if (!businessProfile) {
                alert('No business profile found. Please create one in Settings.');
                setIsPrinting(null);
                return;
            }

            // Get transaction history
            const transactions = await db.partyTransactions
                .where('partyId')
                .equals(party.id!)
                .reverse()
                .sortBy('date');

            // Header
            encoder.align('CENTER');
            if (boldHeader) encoder.bold(true);
            if (headerFontSize === 'large') encoder.size('LARGE');
            encoder.textLine(businessProfile.businessName);
            encoder.size('NORMAL');
            if (boldHeader) encoder.bold(false);

            if (businessProfile.phone) {
                if (boldHeader) encoder.bold(true);
                if (headerFontSize === 'large') encoder.size('LARGE');
                encoder.textLine(businessProfile.phone);
                encoder.size('NORMAL');
                if (boldHeader) encoder.bold(false);
            }

            encoder.textLine('='.repeat(maxChars));
            if (boldHeader) encoder.bold(true);
            if (headerFontSize === 'large') encoder.size('LARGE');
            encoder.textLine('PARTY STATEMENT');
            encoder.size('NORMAL');
            if (boldHeader) encoder.bold(false);
            encoder.textLine('='.repeat(maxChars));

            // Party Details
            encoder.align('LEFT');
            encoder.textLine(`Party: ${party.name}`);
            encoder.textLine(`Phone: ${party.mobile}`);
            if (party.aadhar) {
                encoder.textLine(`ID: ${party.aadhar}`);
            }
            encoder.textLine(`Date: ${new Date().toLocaleDateString()}`);
            encoder.textLine('-'.repeat(maxChars));

            // Current Balance
            encoder.bold(true)
                .size('LARGE')
                .align('CENTER');
            const balanceText = party.balance >= 0 ? 'BALANCE DUE' : 'ADVANCE';
            encoder.textLine(balanceText);
            encoder.textLine(`Rs${Math.abs(party.balance).toFixed(0)}`);
            encoder.size('NORMAL')
                .bold(false)
                .align('LEFT');
            encoder.textLine('='.repeat(maxChars));

            // Transaction History
            if (transactions && transactions.length > 0) {
                encoder.bold(true).textLine('TRANSACTION HISTORY').bold(false);
                encoder.textLine('-'.repeat(maxChars));

                // Header row
                const dateW = 9;
                const typeW = maxChars - dateW - 10;
                const amtW = 10;
                const headerLine = 'Date'.padEnd(dateW) + 'Type'.padEnd(typeW) + 'Amount'.padStart(amtW);
                if (boldItems) encoder.bold(true);
                if (itemsFontSize === 'large') encoder.size('LARGE');
                encoder.textLine(headerLine);
                encoder.size('NORMAL');
                if (boldItems) encoder.bold(false);
                encoder.textLine('-'.repeat(maxChars));

                // Transaction rows (last 15)
                const recentTx = transactions.slice(0, 15);
                for (const tx of recentTx) {
                    const date = new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit' });
                    const typeLabel = tx.type === 'CREDIT_BILL' ? 'Bill' : tx.type === 'PAYMENT' ? 'Paid' : 'Charge';
                    const sign = tx.type === 'PAYMENT' ? '-' : '+';
                    const amt = `${sign}${tx.amount.toFixed(0)}`;

                    const txLine = date.padEnd(dateW) + typeLabel.padEnd(typeW) + amt.padStart(amtW);
                    if (itemsFontSize === 'large') encoder.size('LARGE');
                    encoder.textLine(txLine);
                    encoder.size('NORMAL');
                }

                if (transactions.length > 15) {
                    encoder.textLine('-'.repeat(maxChars));
                    encoder.align('CENTER');
                    if (itemsFontSize === 'large') encoder.size('LARGE');
                    encoder.textLine(`(${transactions.length - 15} more transactions)`);
                    encoder.size('NORMAL');
                    encoder.align('LEFT');
                }
            } else {
                encoder.align('CENTER');
                if (itemsFontSize === 'large') encoder.size('LARGE');
                encoder.textLine('No transactions yet');
                encoder.size('NORMAL');
                encoder.align('LEFT');
            }

            encoder.textLine('='.repeat(maxChars));
            encoder.align('CENTER');
            if (boldFooter) encoder.bold(true);
            if (footerFontSize === 'large') encoder.size('LARGE');
            encoder.textLine('*** Thank You ***');
            encoder.size('NORMAL');
            if (boldFooter) encoder.bold(false);
            encoder.feed(3).cut();

            // Print
            const bytes = encoder.getBytes();
            await BluetoothService.write(bytes);

            setIsPrinting(null);
        } catch (error) {
            console.error('Print error:', error);
            alert(`Failed to print: ${error}`);
            setIsPrinting(null);
        }
    };

    const handleTransaction = async () => {
        if (!selectedPartyForTransaction || !transactionAmount) return;

        const amount = parseFloat(transactionAmount);
        if (isNaN(amount) || amount <= 0) {
            alert("Please enter a valid amount");
            return;
        }

        try {
            const currentBalance = selectedPartyForTransaction.balance || 0;
            const newBalance = transactionType === 'payment'
                ? currentBalance - amount
                : currentBalance + amount;

            await db.parties.update(selectedPartyForTransaction.id!, {
                balance: newBalance
            });

            await db.partyTransactions.add({
                partyId: selectedPartyForTransaction.id!,
                date: new Date().toISOString(),
                type: transactionType === 'payment' ? 'PAYMENT' : 'CHARGE',
                amount: amount,
                description: transactionType === 'payment' ? 'Manual Payment' : 'Manual Charge'
            });

            setShowTransactionModal(false);
            setTransactionAmount('');
            setSelectedPartyForTransaction(null);
        } catch (error) {
            console.error("Failed to update balance", error);
            alert("Error processing transaction");
        }
    };

    return (
        <div className="p-4 space-y-4 pb-24 w-full lg:max-w-7xl xl:max-w-full mx-auto lg:px-6 xl:px-8">
            <div className="flex justify-between items-center gap-2">
                <h1 className="text-2xl font-bold">Parties</h1>
                <select
                    className="border rounded p-1 text-sm bg-white max-w-[150px]"
                    value={selectedProfileId || ''}
                    onChange={(e) => setSelectedProfileId(Number(e.target.value) || null)}
                >
                    <option value="">All Profiles</option>
                    {profiles?.map(p => (
                        <option key={p.id} value={p.id}>{p.businessName}</option>
                    ))}
                </select>
                <Button size="sm" onClick={() => {
                    setCurrentParty({
                        profileId: selectedProfileId || Number(localStorage.getItem('defaultProfileId')) || undefined
                    });
                    setIsEditing(true);
                }}>
                    <Plus className="w-4 h-4 mr-1" /> New Party
                </Button>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                    placeholder="Search by name or mobile..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="space-y-3">
                {parties?.map((party) => (
                    <Card key={party.id} className="overflow-hidden">
                        <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-lg flex items-center gap-2">
                                        <User className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                        <span className="truncate">{party.name}</span>
                                    </div>
                                    <div className="text-sm text-gray-500 flex items-center gap-1">
                                        <Phone className="w-3 h-3 flex-shrink-0" /> {party.mobile}
                                    </div>
                                    {party.aadhar && <div className="text-xs text-gray-400 mt-1">ID: {party.aadhar}</div>}
                                </div>
                                <div className="text-right flex-shrink-0 ml-4">
                                    <div className={`font-bold text-lg ${party.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        ₹{party.balance.toFixed(2)}
                                    </div>
                                    <div className="text-[10px] text-gray-400 uppercase">Balance</div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 justify-end">
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-7 text-xs" 
                                    onClick={() => handlePrintPartyBalance(party)}
                                    disabled={isPrinting === party.id}
                                >
                                    <Printer className="w-3 h-3 text-blue-500" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedPartyForHistory(party.id!)}>
                                    <FileText className="w-3 h-3 text-gray-500" />
                                </Button>
                                <Button size="sm" variant="default" className="h-7 text-xs bg-red-600 hover:bg-red-700" onClick={() => {
                                    setSelectedPartyForTransaction(party);
                                    setTransactionType('charge');
                                    setShowTransactionModal(true);
                                }}>
                                    Add
                                </Button>
                                <Button size="sm" variant="default" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => {
                                    setSelectedPartyForTransaction(party);
                                    setTransactionType('payment');
                                    setShowTransactionModal(true);
                                }}>
                                    Pay
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleEdit(party)}>
                                    <Edit className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteParty(party.id!)}>
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {parties?.length === 0 && (
                    <div className="text-center py-10 text-gray-400">
                        No parties found.
                    </div>
                )}
            </div>

            {isEditing && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm space-y-4 animate-in zoom-in-95">
                        <h2 className="text-xl font-bold">{currentParty.id ? 'Edit Party' : 'New Party'}</h2>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-gray-500">Business Profile</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={currentParty.profileId || ''}
                                    onChange={(e) => setCurrentParty({ ...currentParty, profileId: Number(e.target.value) })}
                                >
                                    <option value="">Select Profile (Optional)</option>
                                    {profiles?.map(p => (
                                        <option key={p.id} value={p.id}>{p.businessName}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500">Name *</label>
                                <Input
                                    value={currentParty.name || ''}
                                    onChange={(e) => setCurrentParty({ ...currentParty, name: e.target.value })}
                                    placeholder="Enter Customer Name"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500">Mobile Number *</label>
                                <Input
                                    type="tel"
                                    value={currentParty.mobile || ''}
                                    onChange={(e) => setCurrentParty({ ...currentParty, mobile: e.target.value })}
                                    placeholder="Enter Mobile Number"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500">Aadhar / ID (Optional)</label>
                                <Input
                                    value={currentParty.aadhar || ''}
                                    onChange={(e) => setCurrentParty({ ...currentParty, aadhar: e.target.value })}
                                    placeholder="e.g. Aadhar Number"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>Cancel</Button>
                            <Button className="flex-1" onClick={handleSave}>Save</Button>
                        </div>
                    </div>
                </div>
            )}

            {showTransactionModal && selectedPartyForTransaction && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm space-y-4 animate-in zoom-in-95">
                        <h2 className={`text-xl font-bold ${transactionType === 'payment' ? 'text-green-700' : 'text-red-700'}`}>
                            {transactionType === 'payment' ? 'Record Payment' : 'Add Charge'}
                        </h2>
                        <div className="bg-slate-50 p-3 rounded">
                            <div className="font-bold">{selectedPartyForTransaction.name}</div>
                            <div className="text-sm text-gray-500">Current Balance: <span className="text-slate-800 font-bold">₹{selectedPartyForTransaction.balance.toFixed(2)}</span></div>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-gray-500">
                                {transactionType === 'payment' ? 'Amount Received *' : 'Amount Added *'}
                            </label>
                            <Input
                                type="number"
                                autoFocus
                                value={transactionAmount}
                                onChange={(e) => setTransactionAmount(e.target.value)}
                                placeholder="Enter Amount"
                                className="text-lg font-bold"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => {
                                setShowTransactionModal(false);
                                setTransactionAmount('');
                                setSelectedPartyForTransaction(null);
                            }}>Cancel</Button>
                            <Button className={`flex-1 ${transactionType === 'payment' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`} onClick={handleTransaction}>Confirm</Button>
                        </div>
                    </div>
                </div>
            )}

            {selectedPartyForHistory && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg space-y-4 animate-in zoom-in-95 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">Transaction History</h2>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedPartyForHistory(null)}>Close</Button>
                        </div>

                        <div className="overflow-auto flex-1 border rounded">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 sticky top-0">
                                    <tr>
                                        <th className="p-2 text-left">Date</th>
                                        <th className="p-2 text-left">Description</th>
                                        <th className="p-2 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {history?.map((tx) => (
                                        <tr key={tx.id} className="hover:bg-slate-50">
                                            <td className="p-2 text-gray-500 text-xs">
                                                {new Date(tx.date).toLocaleDateString()}
                                            </td>
                                            <td className="p-2">
                                                <div className="font-medium">
                                                    {tx.type === 'CREDIT_BILL' ? 'Bill Purchase' :
                                                        tx.type === 'PAYMENT' ? 'Payment' : 'Charge Added'}
                                                </div>
                                                {tx.description && <div className="text-xs text-gray-400">{tx.description}</div>}
                                            </td>
                                            <td className={`p-2 text-right font-bold ${tx.type === 'PAYMENT' ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                {tx.type === 'PAYMENT' ? '-' : '+'}₹{tx.amount.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                    {history?.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="p-4 text-center text-gray-400">No transactions found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PartiesPage;
