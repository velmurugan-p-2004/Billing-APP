import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { db, Item, BillItem } from '@/db/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Minus, Trash2, ScanLine } from 'lucide-react';
import Scanner from '@/components/Scanner';
import { QRCodeSVG } from 'qrcode.react';
import PrintModal from '@/components/PrintModal';

const Billing = () => {
    const { t } = useTranslation();
    const [cart, setCart] = useState<BillItem[]>([]);
    const [customerName, setCustomerName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
    const [showPayment, setShowPayment] = useState(false);
    const [paymentMode, setPaymentMode] = useState<'cash' | 'upi'>('cash');
    const [lastBillId, setLastBillId] = useState<number | null>(null);
    const [showPrintModal, setShowPrintModal] = useState(false);

    const profiles = useLiveQuery(() => db.profiles.toArray());
    const items = useLiveQuery(() => db.items.toArray());

    // Auto select first profile
    useEffect(() => {
        if (profiles && profiles.length > 0 && !selectedProfileId) {
            setSelectedProfileId(profiles[0].id || null);
        }
    }, [profiles, selectedProfileId]);

    const filteredItems = items?.filter(i =>
        (i.profileId === selectedProfileId || !i.profileId) &&
        (i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.sku.includes(searchQuery))
    ).slice(0, 5); // Limit suggestions

    const addToCart = (item: Item) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...item, quantity: 1 }];
        });
        setSearchQuery('');
    };

    const handleScan = (code: string) => {
        const item = items?.find(i => i.sku === code);
        if (item) {
            addToCart(item);
            setIsScanning(false);
        } else {
            alert('Item not found!');
            setIsScanning(false);
        }
    };

    const updateQuantity = (id: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const removeItem = (id: number) => {
        setCart(prev => prev.filter(i => i.id !== id));
    };

    const [discount, setDiscount] = useState<number>(0);
    const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');

    const subTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalAmount = discountType === 'amount'
        ? Math.max(0, subTotal - discount)
        : Math.max(0, subTotal - (subTotal * discount / 100));

    const selectedProfile = profiles?.find(p => p.id === selectedProfileId);

    const [transactionRef, setTransactionRef] = useState('');

    const generateUPIString = () => {
        if (!selectedProfile?.upiId) return '';
        const pn = encodeURIComponent(selectedProfile.businessName);
        const pa = selectedProfile.upiId;
        const am = totalAmount.toFixed(2);
        const tn = transactionRef;
        return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&tn=${tn}`;
    };

    const handlePriceChange = (id: number, newPrice: string) => {
        const price = parseFloat(newPrice);
        if (isNaN(price) || price < 0) return;

        setCart(prev => prev.map(item =>
            item.id === id ? { ...item, price } : item
        ));
    };

    const location = useLocation();
    const [editingBillId, setEditingBillId] = useState<number | null>(null);

    // Load bill for editing
    useEffect(() => {
        const state = location.state as { editBill?: any };
        if (state?.editBill) {
            const bill = state.editBill;
            setEditingBillId(bill.id);
            setCart(bill.items);
            setCustomerName(bill.customerName || '');
            setPaymentMode(bill.paymentMode || 'cash');
            if (bill.discount) {
                // Heuristic: if discount is clean float, assume amount, else percentage logic is hard to reverse perfectly without storing type. 
                // For now, assume amount.
                setDiscount(bill.discount);
                setDiscountType('amount');
            }
            // Clear history state to prevent reload loop
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const handleSaveBill = async () => {
        if (cart.length === 0) return;

        let billId;

        // If Editing, we need to REVERSE the stock effect of the OLD bill items first
        if (editingBillId) {
            const oldBill = await db.bills.get(editingBillId);
            if (oldBill) {
                // Add back old stock
                for (const item of oldBill.items) {
                    if (item.id) {
                        const dbItem = await db.items.get(item.id);
                        if (dbItem) {
                            await db.items.update(item.id, { stock: dbItem.stock + item.quantity });
                        }
                    }
                }
            }

            // Update existing bill
            await db.bills.update(editingBillId, {
                date: new Date().toISOString(), // Update date to modified time? Or keep original? Typically modified time for returns.
                customerName,
                items: cart,
                totalAmount,
                paymentMode,
                discount: discountType === 'amount' ? discount : (subTotal * discount / 100),
                profileId: selectedProfileId || undefined
            });
            billId = editingBillId;
        } else {
            // New Bill Logic
            const lastBill = await db.bills.orderBy('billNo').last();
            const nextBillNo = (lastBill?.billNo || 0) + 1;

            billId = await db.bills.add({
                billNo: nextBillNo,
                date: new Date().toISOString(),
                customerName,
                items: cart,
                totalAmount,
                paymentMode,
                discount: discountType === 'amount' ? discount : (subTotal * discount / 100),
                profileId: selectedProfileId || undefined
            });
        }

        // DEDUCT stock for current cart items
        for (const item of cart) {
            if (item.id) {
                const dbItem = await db.items.get(item.id);
                if (dbItem) {
                    await db.items.update(item.id, { stock: dbItem.stock - item.quantity });
                }
            }
        }

        setLastBillId(billId as number);
        setCart([]);
        setCustomerName('');
        setDiscount(0);
        setEditingBillId(null);
        setShowPayment(false);
        // Alert removed, showing print modal instead
        setShowPrintModal(true);
    };

    return (
        <div className="p-4 pb-24 max-w-md mx-auto min-h-screen relative flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">{editingBillId ? 'Edit Bill' : t('billing')}</h1>
                <select
                    className="border rounded p-1 text-sm bg-white"
                    value={selectedProfileId || ''}
                    onChange={(e) => setSelectedProfileId(Number(e.target.value))}
                >
                    <option value="">Select Profile</option>
                    {profiles?.map(p => (
                        <option key={p.id} value={p.id}>{p.businessName}</option>
                    ))}
                </select>
            </div>

            {/* Customer & Search */}
            <div className="space-y-3 mb-4">
                <Input
                    placeholder="Customer Name (Optional)"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                />
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Input
                            placeholder="Scan or Search Item..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <div className="absolute top-full left-0 right-0 bg-white border shadow-lg z-10 max-h-40 overflow-auto rounded-b-lg">
                                {filteredItems?.map(item => (
                                    <div
                                        key={item.id}
                                        className="p-2 hover:bg-slate-100 cursor-pointer border-b"
                                        onClick={() => addToCart(item)}
                                    >
                                        <div className="font-medium">{item.name}</div>
                                        <div className="text-xs text-gray-500">Stock: {item.stock} - ₹{item.price}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <Button size="icon" variant="outline" onClick={() => setIsScanning(true)}>
                        <ScanLine className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-40">
                {cart.map((item, index) => (
                    <Card key={index} className="p-2">
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                                <div className="font-medium">{item.name}</div>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => removeItem(item.id!)}>
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>

                            <div className="flex justify-between items-center gap-2">
                                <div className="flex items-center gap-1">
                                    <span className="text-sm text-gray-500">Price: ₹</span>
                                    <Input
                                        type="number"
                                        className="h-7 w-20 px-1 py-0 text-right"
                                        value={item.price}
                                        onChange={(e) => handlePriceChange(item.id!, e.target.value)}
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQuantity(item.id!, -1)}>
                                        <Minus className="w-3 h-3" />
                                    </Button>
                                    <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQuantity(item.id!, 1)}>
                                        <Plus className="w-3 h-3" />
                                    </Button>
                                </div>

                                <div className="font-bold min-w-[3rem] text-right">
                                    ₹{(item.price * item.quantity).toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
                {cart.length === 0 && <div className="text-center text-gray-400 mt-10">Empty Cart</div>}
            </div>

            {/* Bottom Total & Checkout */}
            <div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-md">
                <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>₹{subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                        <span className="text-sm">Discount</span>
                        <div className="flex items-center gap-1 w-1/2">
                            <select
                                className="h-7 text-xs border rounded bg-transparent"
                                value={discountType}
                                onChange={(e) => setDiscountType(e.target.value as any)}
                            >
                                <option value="amount">₹</option>
                                <option value="percentage">%</option>
                            </select>
                            <Input
                                type="number"
                                className="h-7 text-right"
                                placeholder="0"
                                value={discount || ''}
                                onChange={(e) => setDiscount(Number(e.target.value))}
                            />
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-lg font-bold pt-2 border-t">
                        <span>Total Pay</span>
                        <span>₹{totalAmount.toFixed(2)}</span>
                    </div>
                </div>
                <Button className="w-full" size="lg" disabled={cart.length === 0} onClick={() => {
                    setTransactionRef(`Bill-${Date.now()}`);
                    setShowPayment(true);
                }}>
                    Checkout
                </Button>
            </div>

            {/* Payment Modal */}
            {showPayment && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold">Payment & Confirmation</h2>

                        {/* Bill Preview */}
                        <div className="bg-slate-50 p-3 rounded text-sm space-y-2 border">
                            <div className="font-semibold text-center border-b pb-1 mb-2">Bill Summary</div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {cart.map((item, i) => (
                                    <div key={i} className="flex justify-between">
                                        <span className="truncate w-32">{item.name}</span>
                                        <span className="text-gray-500">x{item.quantity}</span>
                                        <span className="font-medium">₹{(item.price * item.quantity).toFixed(0)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="border-t pt-2 space-y-1">
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>Subtotal</span>
                                    <span>₹{subTotal.toFixed(2)}</span>
                                </div>
                                {discount > 0 && (
                                    <div className="flex justify-between text-xs text-green-600">
                                        <span>Discount</span>
                                        <span>-₹{discountType === 'amount' ? discount : (subTotal * discount / 100).toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-lg pt-1">
                                    <span>Total Pay</span>
                                    <span>₹{totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant={paymentMode === 'cash' ? 'default' : 'outline'}
                                onClick={() => setPaymentMode('cash')}
                            >
                                Cash
                            </Button>
                            <Button
                                variant={paymentMode === 'upi' ? 'default' : 'outline'}
                                onClick={() => setPaymentMode('upi')}
                            >
                                UPI
                            </Button>
                        </div>

                        {paymentMode === 'upi' && selectedProfile?.upiId && (
                            <div className="flex justify-center py-4 bg-slate-50 rounded">
                                <QRCodeSVG value={generateUPIString()} size={150} />
                            </div>
                        )}

                        {paymentMode === 'upi' && !selectedProfile?.upiId && (
                            <div className="text-red-500 text-sm text-center">No UPI ID configured in Settings</div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setShowPayment(false)}>Cancel</Button>
                            <Button className="flex-1" onClick={handleSaveBill}>Confirm & Save</Button>
                        </div>
                    </div>
                </div>
            )}

            {isScanning && <Scanner onScan={handleScan} onClose={() => setIsScanning(false)} />}

            {showPrintModal && lastBillId && (
                <PrintModal
                    billId={lastBillId}
                    onClose={() => setShowPrintModal(false)}
                />
            )}
        </div>
    );
};

export default Billing;
