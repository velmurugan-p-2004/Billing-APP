import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { db, Item, BillItem, Category, Party } from '@/db/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Minus, Trash2, ScanLine, UserPlus, Pause, Play, List, X } from 'lucide-react';
import Scanner from '@/components/Scanner';
import { QRCodeSVG } from 'qrcode.react';
import PrintModal from '@/components/PrintModal';
import CategoryItemSelector from '@/components/CategoryItemSelector';

const Billing = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [cart, setCart] = useState<BillItem[]>([]);
    const [lastAddedItemId, setLastAddedItemId] = useState<number | null>(null);
    const [customerName, setCustomerName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
    const [showPayment, setShowPayment] = useState(false);
    const [billDateTime, setBillDateTime] = useState<string>(() => {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);
        return localISOTime;
    });

    const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'credit'>('cash');
    const [lastBillId, setLastBillId] = useState<number | null>(null);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [categoryItems, setCategoryItems] = useState<Item[]>([]);

    // Credit / Party State
    const [selectedParty, setSelectedParty] = useState<Party | null>(null);
    const [partySearchQuery, setPartySearchQuery] = useState('');
    const [newPartyMobile, setNewPartyMobile] = useState('');
    const [newPartyAadhar, setNewPartyAadhar] = useState('');
    const [newPartyProfileId, setNewPartyProfileId] = useState<number | undefined>(undefined);
    const [showNewPartyForm, setShowNewPartyForm] = useState(false);

    // Hold Bill State - Persist in localStorage
    const [heldBills, setHeldBills] = useState<Array<{
        id: string;
        cart: BillItem[];
        customerName: string;
        selectedParty: Party | null;
        paymentMode: 'cash' | 'upi' | 'credit';
        discount: number;
        discountType: 'amount' | 'percentage';
        timestamp: Date;
    }>>(() => {
        // Load held bills from localStorage on mount
        const saved = localStorage.getItem('heldBills');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Convert timestamp strings back to Date objects
                return parsed.map((bill: any) => ({
                    ...bill,
                    timestamp: new Date(bill.timestamp)
                }));
            } catch (error) {
                console.error('Failed to parse held bills:', error);
                return [];
            }
        }
        return [];
    });
    const [showHeldBillsModal, setShowHeldBillsModal] = useState(false);

    // Save held bills to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('heldBills', JSON.stringify(heldBills));
    }, [heldBills]);

    const profiles = useLiveQuery(() => db.profiles.toArray());
    const items = useLiveQuery(() => {
        if (selectedProfileId) {
            return db.items.filter(i => i.profileId === selectedProfileId).toArray();
        }
        return db.items.toArray();
    }, [selectedProfileId]);

    const categories = useLiveQuery(() => {
        if (selectedProfileId) {
            return db.categories.filter(c => c.profileId === selectedProfileId).toArray();
        }
        return db.categories.toArray();
    }, [selectedProfileId]);
    const parties = useLiveQuery(() => {
        let query = db.parties.toCollection();
        // Filter by profile if set
        if (selectedProfileId) {
            query = db.parties.where('profileId').equals(selectedProfileId);
        } else {
            // If no profile selected, maybe show all? Or match unset?
            // Based on previous logic, let's show all or just match no profile.
            // But 'db.parties.where' needs an index. 'profileId' is indexed in v4.
            // If selectedProfileId is null, we might want to show all for backward compat or just those without profile.
            // For safety, let's just use filter to handle null/undefined profileId vs no profileId field.
            query = query.filter(p => p.profileId === selectedProfileId || !p.profileId);
        }
        return query.toArray();
    }, [selectedProfileId]);

    // Auto select profile logic
    useEffect(() => {
        if (profiles && profiles.length > 0 && !selectedProfileId) {
            const defaultIdStr = localStorage.getItem('defaultProfileId');
            if (defaultIdStr) {
                const defaultId = parseInt(defaultIdStr);
                const exists = profiles.find(p => p.id === defaultId);
                if (exists) {
                    setSelectedProfileId(defaultId);
                    return;
                }
            }
            // Fallback to first profile if no default or default not found
            setSelectedProfileId(profiles[0].id || null);
        }
    }, [profiles, selectedProfileId]);

    // Apply default discount from selected profile (only once when profile changes)
    useEffect(() => {
        if (selectedProfile?.defaultDiscountValue && selectedProfile.defaultDiscountValue > 0) {
            // Only apply if we don't have items in cart yet
            if (cart.length === 0) {
                setDiscount(selectedProfile.defaultDiscountValue);
                setDiscountType(selectedProfile.defaultDiscountType || 'amount');
            }
        }
    }, [selectedProfileId]); // Only trigger when profile changes, not on discount/cart changes


    // Check if search query matches a category SKU
    const matchedCategory = searchQuery ? categories?.find(c => c.sku === searchQuery.trim()) : null;

    const filteredItems = matchedCategory
        ? // If category SKU matched, show all items in that category ONLY if they match profile
        items?.filter(i => i.categoryId === matchedCategory.id && i.profileId === selectedProfileId)
        : // Otherwise, filter items by name or individual SKU
        items?.filter(i =>
            i.profileId === selectedProfileId &&
            (i.name.toLowerCase().includes(searchQuery.toLowerCase()) || (i.sku && i.sku.includes(searchQuery)))
        ).slice(0, 5); // Limit suggestions

    const addToCart = (item: Item) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            setLastAddedItemId(item.id!);
            return [...prev, { ...item, quantity: 1 }];
        });
        setSearchQuery('');
    };

    const handleScan = async (code: string) => {
        // First, check if it's a category SKU
        const category = categories?.find(c => c.sku === code);
        if (category) {
            // Get all items in this category
            const catItems = items?.filter(i => i.categoryId === category.id) || [];
            if (catItems.length === 0) {
                alert('No items found in this category!');
                setIsScanning(false);
                return;
            }
            // Show category item selector
            setSelectedCategory(category);
            setCategoryItems(catItems);
            setIsScanning(false);
            return;
        }

        // If not a category, check individual item SKU (backward compatibility)
        const item = items?.find(i => i.sku === code);
        if (item) {
            addToCart(item);
            setIsScanning(false);
        } else {
            alert('Item or Category not found!');
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
        // Allow empty string to let user clear input
        if (newPrice === '') {
            setCart(prev => prev.map(item => item.id === id ? { ...item, price: 0 } : item));
            return;
        }
        const price = parseFloat(newPrice);
        if (isNaN(price)) return; // Allow negative? Probably not.

        setCart(prev => prev.map(item =>
            item.id === id ? { ...item, price } : item
        ));
    };

    const handleMrpChange = (id: number, newMrp: string) => {
        if (newMrp === '') {
            setCart(prev => prev.map(item => item.id === id ? { ...item, mrp: 0 } : item));
            return;
        }
        const mrp = parseFloat(newMrp);
        if (isNaN(mrp)) return;

        setCart(prev => prev.map(item =>
            item.id === id ? { ...item, mrp } : item
        ));
    };

    // Hold Bill Functions
    const holdCurrentBill = () => {
        if (cart.length === 0) {
            alert('No items to hold');
            return;
        }

        const heldBill = {
            id: Date.now().toString(),
            cart: [...cart],
            customerName: customerName || (selectedParty?.name) || 'Walk-in Customer',
            selectedParty: selectedParty,
            paymentMode,
            discount,
            discountType,
            timestamp: new Date()
        };

        setHeldBills([...heldBills, heldBill]);
        
        // Clear current bill
        setCart([]);
        setCustomerName('');
        setSelectedParty(null);
        setPaymentMode('cash');
        setDiscount(0);
        setSearchQuery('');
        setPaidAmount(0);
        
        alert(`✅ Bill held for ${heldBill.customerName}`);
    };

    const resumeHeldBill = (heldBillId: string) => {
        const heldBill = heldBills.find(b => b.id === heldBillId);
        if (!heldBill) return;

        // Save current bill if it has items
        if (cart.length > 0) {
            const currentBill = {
                id: Date.now().toString(),
                cart: [...cart],
                customerName: customerName || (selectedParty?.name) || 'Walk-in Customer',
                selectedParty: selectedParty,
                paymentMode,
                discount,
                discountType,
                timestamp: new Date()
            };
            setHeldBills([...heldBills.filter(b => b.id !== heldBillId), currentBill]);
        } else {
            setHeldBills(heldBills.filter(b => b.id !== heldBillId));
        }

        // Restore held bill
        setCart(heldBill.cart);
        setCustomerName(heldBill.customerName);
        setSelectedParty(heldBill.selectedParty);
        setPaymentMode(heldBill.paymentMode);
        setDiscount(heldBill.discount);
        setDiscountType(heldBill.discountType);
        
        setShowHeldBillsModal(false);
    };

    const deleteHeldBill = (heldBillId: string) => {
        if (confirm('Are you sure you want to delete this held bill?')) {
            setHeldBills(heldBills.filter(b => b.id !== heldBillId));
        }
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
            const billDate = new Date(bill.date);
            const offset = billDate.getTimezoneOffset() * 60000;
            setBillDateTime(new Date(billDate.getTime() - offset).toISOString().slice(0, 16));
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

    const [paidAmount, setPaidAmount] = useState<number>(0);

    // Auto update paid amount when total changes, but only if not credit (or maybe just reset?)
    // Actually, distinct UX: 
    // If credit, paidAmount default to 0. 
    // If cash/UPI, paidAmount is implicitly totalAmount (but we don't necessarily show input).

    const handleSaveBill = async () => {
        if (cart.length === 0) return;

        let finalPartyId = selectedParty?.id;

        // Handle Credit Logic
        if (paymentMode === 'credit') {
            if (!selectedParty && !showNewPartyForm) {
                alert("Please select a party or create a new one for credit billing.");
                return;
            }

            if (showNewPartyForm) {
                if (!customerName || !newPartyMobile) {
                    alert("Name and Mobile are required for new party.");
                    return;
                }
                // Create new party
                try {
                    finalPartyId = await db.parties.add({
                        name: customerName,
                        mobile: newPartyMobile,
                        aadhar: newPartyAadhar,
                        balance: 0,
                        profileId: newPartyProfileId || selectedProfileId || undefined
                    }) as number;
                } catch (e) {
                    console.error(e);
                    alert("Error creating party. Mobile number might be duplicate?"); // Mobile is not unique key index, so duplicate allowed unless enforced.
                    // return; 
                }
            }
        }

        let billId;

        const effectivePaidAmount = paymentMode === 'credit' ? paidAmount : totalAmount;

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

                // Revert party balance if it was credit
                // This is complex b/c logic might have changed. 
                // Simplification for now: If we edit a bill, we assume managing balance manually or we just don't perfect this yet.
                // Or: remove old debt effect. 
                if (oldBill.partyId && oldBill.paymentMode === 'credit') {
                    const oldParty = await db.parties.get(oldBill.partyId);
                    const oldPaid = oldBill.paidAmount || 0;
                    const oldTotal = oldBill.totalAmount;
                    const oldCredit = oldTotal - oldPaid;
                    if (oldParty) {
                        await db.parties.update(oldBill.partyId, {
                            balance: (oldParty.balance || 0) - oldCredit
                        });
                    }
                }
            }

            // Update existing bill
            await db.bills.update(editingBillId, {
                date: new Date(billDateTime).toISOString(),
                customerName,
                items: cart,
                totalAmount,
                paymentMode,
                discount: discountType === 'amount' ? discount : (subTotal * discount / 100),
                profileId: selectedProfileId || undefined,
                partyId: finalPartyId,
                paidAmount: effectivePaidAmount
            });
            billId = editingBillId;
        } else {
            // New Bill Logic
            // New Bill Logic
            // Find last bill for THIS profile to determine next bill number
            const lastBill = await db.bills
                .orderBy('billNo')
                .reverse()
                .filter(b => b.profileId === (selectedProfileId || undefined))
                .first();
            const nextBillNo = (lastBill?.billNo || 0) + 1;

            billId = await db.bills.add({
                billNo: nextBillNo,
                date: new Date(billDateTime).toISOString(),
                customerName: paymentMode === 'credit' 
                    ? (selectedParty ? selectedParty.name : customerName) 
                    : (customerName || ''),
                items: cart,
                totalAmount,
                paymentMode,
                discount: discountType === 'amount' ? discount : (subTotal * discount / 100),
                profileId: selectedProfileId || undefined,
                partyId: finalPartyId,
                paidAmount: effectivePaidAmount
            });

            // Log Party Transaction for New Credit Bills
            if (paymentMode === 'credit' && finalPartyId) {
                // 1. Log the Bill (Debt)
                await db.partyTransactions.add({
                    partyId: finalPartyId,
                    date: new Date().toISOString(),
                    type: 'CREDIT_BILL',
                    amount: totalAmount,
                    billId: Number(billId),
                    description: `Bill #${nextBillNo}`
                });

                // 2. Log Initial Payment if any
                if (effectivePaidAmount && effectivePaidAmount > 0) {
                    await db.partyTransactions.add({
                        partyId: finalPartyId,
                        date: new Date().toISOString(),
                        type: 'PAYMENT',
                        amount: effectivePaidAmount,
                        billId: Number(billId),
                        description: `Payment for Bill #${nextBillNo}`
                    });
                }
            }
        }

        // DEDUCT stock for current cart items (only if stock tracking is enabled)
        for (const item of cart) {
            if (item.id && item.trackStock !== false) {
                const dbItem = await db.items.get(item.id);
                if (dbItem) {
                    await db.items.update(item.id, { stock: dbItem.stock - item.quantity });
                }
            }
        }

        // Update Party Balance
        if (paymentMode === 'credit' && finalPartyId) {
            const party = await db.parties.get(finalPartyId);
            if (party) {
                const creditAmount = totalAmount - effectivePaidAmount;
                await db.parties.update(finalPartyId, {
                    balance: (party.balance || 0) + creditAmount
                });
            }
        }

        setLastBillId(billId as number);
        setCart([]);
        setCustomerName('');
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        setBillDateTime(new Date(now.getTime() - offset).toISOString().slice(0, 16)); // Reset to current local time
        setDiscount(0);
        setEditingBillId(null);
        setShowPayment(false);
        // Reset Credit State
        setPaymentMode('cash');
        setSelectedParty(null);
        setPartySearchQuery('');
        setNewPartyMobile('');
        setShowNewPartyForm(false);
        setPaidAmount(0);

        // Check default printer preference
        const defaultPrinter = localStorage.getItem('defaultPrinterType');
        if (defaultPrinter && defaultPrinter !== 'ask') {
            const template = defaultPrinter === 'a4' ? 'professional' : 'simple';
            navigate(`/print/${billId}?template=${template}&autoprint=true`);
        } else {
            setShowPrintModal(true);
        }
    };

    return (
        <div className="p-4 pb-24 w-full lg:max-w-7xl xl:max-w-full mx-auto min-h-screen relative flex flex-col lg:px-6 xl:px-8">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">{editingBillId ? 'Edit Bill' : t('billing')}</h1>
                <div className="flex items-center gap-2">
                    {/* Hold Bill Buttons */}
                    <Button
                        onClick={holdCurrentBill}
                        disabled={cart.length === 0}
                        variant="outline"
                        className="bg-yellow-50 hover:bg-yellow-100 border-yellow-300 text-yellow-700 disabled:opacity-50"
                        size="sm"
                    >
                        <Pause className="h-4 w-4 mr-1" />
                        Hold
                        {heldBills.length > 0 && (
                            <span className="ml-1 bg-yellow-500 text-white rounded-full px-1.5 py-0.5 text-xs font-bold">
                                {heldBills.length}
                            </span>
                        )}
                    </Button>

                    {heldBills.length > 0 && (
                        <Button
                            onClick={() => setShowHeldBillsModal(true)}
                            variant="outline"
                            className="bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700"
                            size="sm"
                        >
                            <List className="h-4 w-4 mr-1" />
                            {heldBills.length}
                        </Button>
                    )}
                    
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
            </div>

            {/* Customer & Search */}
            <div className="space-y-3 mb-4">
                <Input
                    placeholder="Customer Name (Optional)"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                />
                <div>
                    <label className="text-xs text-gray-600 mb-1 block">Bill Date & Time</label>
                    <Input
                        type="datetime-local"
                        value={billDateTime}
                        onChange={e => setBillDateTime(e.target.value)}
                        className="text-sm"
                    />
                </div>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Input
                            placeholder="Scan or Search Item..."
                            inputMode="numeric"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="border-blue-500 placeholder:text-blue-500"
                            onKeyDown={async (e) => {
                                if (e.key === 'Enter' && searchQuery.trim()) {
                                    // Check if it's a category SKU
                                    const category = categories?.find(c => c.sku === searchQuery.trim());
                                    if (category) {
                                        const catItems = items?.filter(i => i.categoryId === category.id) || [];
                                        if (catItems.length === 0) {
                                            alert('No items found in this category!');
                                            return;
                                        }
                                        setSelectedCategory(category);
                                        setCategoryItems(catItems);
                                        setSearchQuery('');
                                        return;
                                    }

                                    // Check if it's an individual item SKU
                                    const item = items?.find(i => i.sku === searchQuery.trim());
                                    if (item) {
                                        addToCart(item);
                                        return;
                                    }

                                    // If no match found
                                    alert('Item or Category not found!');
                                }
                            }}
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
                                        <div className="text-xs text-gray-500">
                                            {item.trackStock !== false && `Stock: ${item.stock} - `}₹{item.price}
                                        </div>
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
                                <div className="font-medium">
                                    {item.name}
                                    {item.unit && <span className="text-xs text-blue-600 ml-1">({item.unit})</span>}
                                </div>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => removeItem(item.id!)}>
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>

                            <div className="flex justify-between items-center gap-2">
                                <div className="flex flex-col gap-1 items-end">
                                    {profiles?.find(p => p.id === selectedProfileId)?.enableMRP && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-base font-bold text-gray-500 w-12 text-right">MRP</span>
                                            <Input
                                                type="number"
                                                className="h-9 w-28 px-2 py-0 text-right font-bold border-blue-500"
                                                value={item.mrp || ''}
                                                onChange={(e) => handleMrpChange(item.id!, e.target.value)}
                                            />
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-bold text-blue-600 w-12 text-right">Price</span>
                                        <Input
                                            ref={(el) => {
                                                if (el && lastAddedItemId === item.id && profiles?.find(p => p.id === selectedProfileId)?.autoPriceEntry) {
                                                    setTimeout(() => {
                                                        el.focus();
                                                        el.select();
                                                        setLastAddedItemId(null);
                                                    }, 100);
                                                }
                                            }}
                                            type="number"
                                            className="h-9 w-28 px-2 py-0 text-right font-bold border-blue-500"
                                            value={item.price || ''}
                                            onChange={(e) => handlePriceChange(item.id!, e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => updateQuantity(item.id!, -1)}>
                                        <Minus className="w-4 h-4" />
                                    </Button>
                                    <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => updateQuantity(item.id!, 1)}>
                                        <Plus className="w-4 h-4" />
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
            {!searchQuery && (
                <div
                    className="fixed left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-md z-40"
                    style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}
                >
                <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>₹{subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                        <span className="text-sm font-bold">Discount</span>
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
                                className="h-7 text-right border-blue-500"
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
                <Button
                    className="w-full text-white hover:opacity-90"
                    size="lg"
                    disabled={cart.length === 0}
                    style={{ backgroundColor: 'rgb(100 198 58 / 89%)' }}
                    onClick={() => {
                        setTransactionRef(`Bill-${Date.now()}`);
                        setShowPayment(true);
                        setPaidAmount(0);
                    }}
                >
                    Checkout
                </Button>
            </div>
            )}

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

                        <div className="flex gap-2">
                            <Button
                                variant={paymentMode === 'cash' ? 'default' : 'outline'}
                                onClick={() => setPaymentMode('cash')}
                                className="flex-1"
                            >
                                Cash
                            </Button>
                            <Button
                                variant={paymentMode === 'upi' ? 'default' : 'outline'}
                                onClick={() => setPaymentMode('upi')}
                                className="flex-1"
                            >
                                UPI
                            </Button>
                            <Button
                                variant={paymentMode === 'credit' ? 'default' : 'outline'}
                                onClick={() => {
                                    setPaymentMode('credit');
                                    setCustomerName(customerName); // Sync
                                    setPartySearchQuery(customerName); // Auto search
                                }}
                                className="flex-1"
                            >
                                Credit
                            </Button>
                        </div>


                        {/* Credit Payment Fields */}
                        {paymentMode === 'credit' && (
                            <div className="bg-blue-50 p-3 rounded border border-blue-200 space-y-3 animate-in fade-in zoom-in-95">
                                {!showNewPartyForm ? (
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-blue-700">Select Customer (Party)</label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={selectedParty?.id || ''}
                                            onChange={(e) => {
                                                const partyId = Number(e.target.value);
                                                const party = parties?.find(p => p.id === partyId);
                                                setSelectedParty(party || null);
                                            }}
                                        >
                                            <option value="">Select Party</option>
                                            {parties?.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} ({p.mobile})
                                                </option>
                                            ))}
                                        </select>

                                        {selectedParty ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between p-2 bg-white border rounded">
                                                    <div>
                                                        <div className="font-bold text-sm">{selectedParty.name}</div>
                                                        <div className="text-xs text-gray-500">Bal: ₹{selectedParty.balance}</div>
                                                    </div>
                                                    <Button size="sm" variant="ghost" onClick={() => setSelectedParty(null)}>Change</Button>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 space-y-1">
                                                        <label className="text-xs font-bold text-gray-700">Paid Amount</label>
                                                        <Input
                                                            type="number"
                                                            placeholder="0"
                                                            className="bg-white h-9"
                                                            value={paidAmount || ''}
                                                            onChange={(e) => setPaidAmount(Number(e.target.value))}
                                                        />
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <label className="text-xs font-bold text-gray-700">To Credit</label>
                                                        <div className="h-9 px-3 py-2 bg-slate-100 border rounded text-sm font-medium text-red-600">
                                                            ₹{(Math.max(0, totalAmount - paidAmount)).toFixed(2)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <Button
                                                variant="secondary"
                                                className="w-full text-xs h-8"
                                                onClick={() => {
                                                    setShowNewPartyForm(true);
                                                    setCustomerName(partySearchQuery); // Pre-fill name from search
                                                    setNewPartyProfileId(selectedProfileId || undefined);
                                                }}
                                            >
                                                <UserPlus className="w-3 h-3 mr-1" /> Create New Customer
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-blue-700">New Customer Details</span>
                                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowNewPartyForm(false)}>Cancel</Button>
                                        </div>
                                        <select
                                            className="bg-white h-8 text-sm w-full border rounded px-2"
                                            value={newPartyProfileId || ''}
                                            onChange={(e) => setNewPartyProfileId(Number(e.target.value))}
                                        >
                                            <option value="">Select Profile (Optional)</option>
                                            {profiles?.map(p => (
                                                <option key={p.id} value={p.id}>{p.businessName}</option>
                                            ))}
                                        </select>
                                        <Input
                                            placeholder="Customer Name *"
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            className="bg-white h-8 text-sm"
                                        />
                                        <Input
                                            placeholder="Mobile Number *"
                                            value={newPartyMobile}
                                            onChange={(e) => setNewPartyMobile(e.target.value)}
                                            className="bg-white h-8 text-sm"
                                            type="tel"
                                        />
                                        <Input
                                            placeholder="Aadhar No (Optional)"
                                            value={newPartyAadhar}
                                            onChange={(e) => setNewPartyAadhar(e.target.value)}
                                            className="bg-white h-8 text-sm"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {paymentMode === 'upi' && selectedProfile?.upiId && (
                            <div className="flex justify-center py-4 bg-slate-50 rounded">
                                <QRCodeSVG value={generateUPIString()} size={150} />
                            </div>
                        )}

                        {paymentMode === 'upi' && !selectedProfile?.upiId && (
                            <div className="text-red-500 text-sm text-center">No UPI ID configured in Settings</div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <Button
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                                onClick={() => setShowPayment(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 text-white hover:opacity-90"
                                style={{ backgroundColor: 'rgb(100 198 58 / 89%)' }}
                                onClick={handleSaveBill}
                            >
                                Confirm & Save
                            </Button>
                        </div>
                    </div>
                </div>
            )
            }


            {isScanning && <Scanner onScan={handleScan} onClose={() => setIsScanning(false)} />}

            {
                showPrintModal && lastBillId && (
                    <PrintModal
                        billId={lastBillId}
                        onClose={() => setShowPrintModal(false)}
                    />
                )
            }

            {
                selectedCategory && (
                    <CategoryItemSelector
                        category={selectedCategory}
                        items={categoryItems}
                        onSelect={addToCart}
                        onClose={() => {
                            setSelectedCategory(null);
                            setCategoryItems([]);
                        }}
                    />
                )
            }

            {/* Held Bills Modal */}
            {showHeldBillsModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden">
                        <div className="bg-indigo-600 text-white px-6 py-4 flex justify-between items-center">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <List className="h-6 w-6" />
                                Held Bills ({heldBills.length})
                            </h2>
                            <button
                                onClick={() => setShowHeldBillsModal(false)}
                                className="text-white hover:text-gray-200 transition-colors"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
                            {heldBills.length === 0 ? (
                                <div className="text-center text-gray-500 py-8">
                                    <List className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                    <p>No held bills</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {heldBills.map((heldBill) => {
                                        const subTotal = heldBill.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                                        const finalTotal = heldBill.discountType === 'amount'
                                            ? Math.max(0, subTotal - heldBill.discount)
                                            : Math.max(0, subTotal - (subTotal * heldBill.discount / 100));

                                        return (
                                            <div
                                                key={heldBill.id}
                                                className="border-2 rounded-lg p-4 hover:shadow-lg transition-all hover:border-indigo-300"
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex-1">
                                                        <h3 className="font-bold text-lg text-gray-800">{heldBill.customerName}</h3>
                                                        <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                                                            {heldBill.paymentMode === 'cash' && '💵 Cash'}
                                                            {heldBill.paymentMode === 'upi' && '📱 UPI'}
                                                            {heldBill.paymentMode === 'credit' && '📝 Credit'}
                                                            <span>•</span>
                                                            <span>{new Date(heldBill.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-2xl font-bold text-indigo-600">
                                                            ₹{finalTotal.toFixed(2)}
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            {heldBill.cart.length} item{heldBill.cart.length !== 1 ? 's' : ''}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mb-3 max-h-32 overflow-y-auto bg-gray-50 rounded p-2">
                                                    {heldBill.cart.map((item, idx) => (
                                                        <div key={idx} className="text-sm text-gray-700 flex justify-between py-1 border-b border-gray-200 last:border-0">
                                                            <span className="font-medium">
                                                                {item.name} × {item.quantity}
                                                                {item.unit && <span className="text-xs text-blue-600 ml-1">({item.unit})</span>}
                                                            </span>
                                                            <span className="font-semibold">₹{(item.price * item.quantity).toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {heldBill.discount > 0 && (
                                                    <div className="text-sm text-gray-600 mb-3 flex justify-between bg-orange-50 p-2 rounded">
                                                        <span>Discount:</span>
                                                        <span className="font-semibold">
                                                            {heldBill.discountType === 'amount'
                                                                ? `₹${heldBill.discount.toFixed(2)}`
                                                                : `${heldBill.discount}%`
                                                            }
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="flex gap-2">
                                                    <Button
                                                        onClick={() => resumeHeldBill(heldBill.id)}
                                                        className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                                                        size="sm"
                                                    >
                                                        <Play className="h-4 w-4 mr-2" />
                                                        Resume Bill
                                                    </Button>
                                                    <Button
                                                        onClick={() => deleteHeldBill(heldBill.id)}
                                                        variant="outline"
                                                        size="sm"
                                                        className="border-red-500 text-red-500 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Billing;

