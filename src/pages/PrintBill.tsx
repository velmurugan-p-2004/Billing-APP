import { useEffect, useRef, Fragment } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { db } from '@/db/db';
import { QRCodeSVG } from 'qrcode.react';
// import { cn } from '@/lib/utils';

const PrintBill = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const template = searchParams.get('template') || 'simple'; // simple, professional, gst
    const autoPrint = searchParams.get('autoprint') === 'true';

    const bill = useLiveQuery(() => db.bills.get(Number(id)), [id]);
    const profile = useLiveQuery(async () => {
        if (!bill) return undefined;
        if (bill.profileId) {
            return await db.profiles.get(bill.profileId);
        }
        return await db.profiles.toCollection().first();
    }, [bill?.profileId]);

    const party = useLiveQuery(() =>
        bill?.partyId ? db.parties.get(bill.partyId) : undefined
        , [bill?.partyId]);

    const hasPrinted = useRef(false);

    useEffect(() => {
        if (bill && profile && autoPrint && !hasPrinted.current) {
            hasPrinted.current = true;
            setTimeout(() => {
                window.print();

                // Navigate back to billing after 5 seconds
                setTimeout(() => {
                    navigate('/billing');
                }, 5000);
            }, 500);
        }
    }, [bill, profile, autoPrint, navigate]);

    if (!bill || !profile) return <div>Loading...</div>;

    // Styles for 58mm Thermal
    if (template === 'simple') {
        const defaultOrder = ['logo', 'shopName', 'description', 'address', 'phone', 'billMeta', 'items', 'totals', 'qrcode', 'footer'];
        const savedOrder = localStorage.getItem('billLayoutOrder');
        const order = savedOrder ? JSON.parse(savedOrder) : defaultOrder;

        const renderSection = (section: string) => {
            switch (section) {
                case 'logo':
                    return profile.logo && localStorage.getItem('showLogo') !== 'false' ? (
                        <div className="flex justify-center mb-2">
                            <img src={profile.logo} alt="Logo" className="max-w-[40mm] max-h-[20mm] object-contain grayscale" />
                        </div>
                    ) : null;
                case 'shopName':
                    return localStorage.getItem('showShopName') !== 'false' ? (
                        <div className="text-center font-bold text-lg">{profile.businessName}</div>
                    ) : null;
                case 'description':
                    return localStorage.getItem('businessDescription') ? (
                        <div className="text-center text-[10px] italic mb-1">{localStorage.getItem('businessDescription')}</div>
                    ) : null;
                case 'address':
                    return localStorage.getItem('showAddress') !== 'false' ? (
                        <div className="text-center whitespace-pre-wrap">{profile.address}</div>
                    ) : null;
                case 'phone':
                    return localStorage.getItem('showPhone') !== 'false' ? (
                        <div className="text-center">{profile.phone}</div>
                    ) : null;
                case 'billMeta':
                    return (
                        <>
                            <div className="border-b border-black my-2 border-dashed"></div>
                            <div className="flex justify-between">
                                <span>Bill: {bill.billNo}</span>
                                <span>{new Date(bill.date).toLocaleDateString()}</span>
                            </div>
                            {bill.customerName && (
                                <div className="text-left mt-1">
                                    <span className="text-[10px] text-gray-600">Customer: </span>
                                    <span className="font-semibold">{bill.customerName}</span>
                                </div>
                            )}
                            {bill.paymentMode === 'credit' && (
                                <div className="text-center font-bold mt-1">CASH/CREDIT BILL</div>
                            )}
                        </>
                    );
                case 'items':
                    const totalQty = bill.items.reduce((acc, item) => acc + item.quantity, 0);
                    const totalMrp = bill.items.reduce((acc, item) => acc + (item.mrp * item.quantity), 0);
                    const subTotal = bill.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
                    return (
                        <>
                            <div className="border-b border-black my-2 border-dashed"></div>
                            <div className="flex font-bold text-[11px]">
                                <span className="w-6">Qty</span>
                                <span className="flex-1">Item</span>
                                {localStorage.getItem('showMrp') !== 'false' && <span className="w-10 text-right">MRP</span>}
                                <span className="w-12 text-right">Amt</span>
                            </div>
                            {bill.items.map((item, i) => (
                                <div key={i} className="flex items-center text-[11px]">
                                    <span className="w-6">{item.quantity}</span>
                                    <span className="flex-1 truncate">
                                        {item.name}
                                        {item.unit && <span className="text-[9px] text-gray-600"> ({item.unit})</span>}
                                    </span>
                                    {localStorage.getItem('showMrp') !== 'false' && <span className="w-10 text-right text-gray-500">{item.mrp}</span>}
                                    <span className="w-12 text-right font-bold">{(item.price * item.quantity).toFixed(0)}</span>
                                </div>
                            ))}
                            <div className="border-t border-black border-dashed mt-1 pt-1 flex text-[11px] font-bold">
                                <span className="w-6">{totalQty}</span>
                                <span className="flex-1 text-right pr-2">Total</span>
                                {localStorage.getItem('showMrp') !== 'false' && <span className="w-10 text-right">{totalMrp}</span>}
                                <span className="w-12 text-right">{subTotal.toFixed(0)}</span>
                            </div>
                            <div className="border-b border-black my-1 border-dashed"></div>
                        </>
                    );
                case 'totals':
                    return (
                        <>
                            {Number(bill.discount) > 0 && (
                                <div className="flex justify-between text-xs mb-1">
                                    <span>Discount</span>
                                    <span>₹{bill.discount}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-extrabold text-lg">
                                <span>Grand Total</span>
                                <span>₹{bill.totalAmount.toFixed(0)}</span>
                            </div>

                            {bill.paymentMode === 'credit' && (
                                <div className="border-t border-dashed pt-1 mt-1 space-y-1 text-right">
                                    <div className="flex justify-between text-xs">
                                        <span>Paid Now</span>
                                        <span>₹{(bill.paidAmount || 0).toFixed(0)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-bold">
                                        <span>Bill Due</span>
                                        <span>₹{(bill.totalAmount - (bill.paidAmount || 0)).toFixed(0)}</span>
                                    </div>
                                    {party && (
                                        <div className="flex justify-between text-sm font-bold border-t border-dashed pt-1">
                                            <span>Net Balance</span>
                                            <span>₹{party.balance.toFixed(0)}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {localStorage.getItem('showSavings') !== 'false' && (
                                <div className="text-center font-bold mt-2 border border-black p-1 rounded">
                                    You Saved: ₹{(
                                        bill.items.reduce((acc, i) => acc + ((i.mrp - i.price) * i.quantity), 0) +
                                        (bill.discount || 0)
                                    ).toFixed(0)}
                                </div>
                            )}
                        </>
                    );
                case 'qrcode':
                    const upiId = localStorage.getItem('upiId');
                    return localStorage.getItem('showQrCode') !== 'false' && upiId ? (
                        <div className="flex flex-col items-center mt-3 mb-2">
                            <div className="text-[10px] font-bold mb-1">Scan to Pay</div>
                            <QRCodeSVG
                                value={`upi://pay?pa=${upiId}&pn=${encodeURIComponent(profile.businessName)}&am=${bill.totalAmount.toFixed(2)}&cu=INR`}
                                size={96}
                                level="M"
                                includeMargin={true}
                            />
                            <div className="text-[9px] text-gray-600 mt-1">₹{bill.totalAmount.toFixed(0)}</div>
                        </div>
                    ) : null;
                case 'footer':
                    return localStorage.getItem('showFooter') !== 'false' ? (
                        <>
                            <div className="text-center mt-4">{localStorage.getItem('footerMessage') || '*** Thank You ***'}</div>
                            <div className="text-center text-[10px] text-gray-500">Provided by Bill Podu</div>
                        </>
                    ) : null;
                default:
                    return null;
            }
        };

        return (
            <div className="w-[58mm] text-[12px] font-mono p-2 mx-auto bg-white">
                {order.map((section: string) => (
                    <Fragment key={section}>
                        {renderSection(section)}
                    </Fragment>
                ))}
            </div>
        );
    }

    // Styles for A4 Professional
    return (
        <div className="p-8 max-w-4xl mx-auto bg-white min-h-screen print:p-0">
            <div className="flex justify-between items-start mb-8">
                <div className="flex gap-4">
                    {profile.logo && localStorage.getItem('showLogo') !== 'false' && (
                        <img src={profile.logo} alt="Logo" className="w-24 h-24 object-contain" />
                    )}
                    <div>
                        <h1 className="text-3xl font-bold text-blue-900">{profile.businessName}</h1>
                        {localStorage.getItem('businessDescription') && (
                            <p className="text-gray-500 italic mb-2">{localStorage.getItem('businessDescription')}</p>
                        )}
                        <p className="text-gray-600 w-64 whitespace-pre-wrap">{profile.address}</p>
                        <p className="text-gray-600">Ph: {profile.phone}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-light text-gray-500">{bill.paymentMode === 'credit' ? 'CREDIT INVOICE' : 'INVOICE'}</h2>
                    <p className="font-bold">#{bill.billNo}</p>
                    <p>Date: {new Date(bill.date).toLocaleDateString()}</p>
                </div>
            </div>

            {bill.customerName && (
                <div className="mb-8">
                    <p className="text-gray-600 text-sm">Bill To:</p>
                    <p className="font-bold text-lg">{bill.customerName}</p>
                </div>
            )}

            <table className="w-full mb-8">
                <thead>
                    <tr className="bg-slate-100 text-slate-600 text-left text-sm uppercase tracking-wider">
                        <th className="p-3">Item Description</th>
                        <th className="p-3 text-right">Price</th>
                        <th className="p-3 text-right">Qty</th>
                        <th className="p-3 text-right">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {bill.items.map((item, i) => (
                        <tr key={i}>
                            <td className="p-3 font-medium">
                                {item.name}
                                {item.unit && <span className="text-xs text-blue-600 ml-1">({item.unit})</span>}
                                {item.mrp > item.price && localStorage.getItem('showMrp') !== 'false' && (
                                    <div className="text-xs text-green-600">MRP: ₹{item.mrp}</div>
                                )}
                            </td>
                            <td className="p-3 text-right">₹{item.price}</td>
                            <td className="p-3 text-right">{item.quantity}</td>
                            <td className="p-3 text-right font-bold">₹{item.price * item.quantity}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 font-bold bg-slate-50">
                    <tr>
                        <td className="p-3 text-right" colSpan={2}></td>
                        <td className="p-3 text-right">{bill.items.reduce((acc, i) => acc + i.quantity, 0)}</td>
                        <td className="p-3"></td>
                    </tr>
                </tfoot>
            </table>

            <div className="flex justify-end">
                <div className="w-64 space-y-2">
                    {localStorage.getItem('showMrp') !== 'false' && (
                        <div className="flex justify-between text-gray-500 font-medium pb-2 border-b">
                            <span>Total MRP</span>
                            <span className="line-through decoration-red-500">₹{bill.items.reduce((acc, i) => acc + (i.mrp * i.quantity), 0).toFixed(2)}</span>
                        </div>
                    )}

                    {localStorage.getItem('showSavings') !== 'false' && (
                        <div className="flex justify-between text-green-600 font-medium">
                            <span>You Saved</span>
                            <span>₹{(
                                bill.items.reduce((acc, i) => acc + ((i.mrp - i.price) * i.quantity), 0) +
                                (bill.discount || 0)
                            ).toFixed(2)}</span>
                        </div>
                    )}
                    {Number(bill.discount) > 0 && (
                        <div className="flex justify-between text-sm pt-2">
                            <span>Discount</span>
                            <span>₹{bill.discount}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-xl pt-4 border-t">
                        <span>Total Amount</span>
                        <span>₹{bill.totalAmount.toFixed(2)}</span>
                    </div>

                    {bill.paymentMode === 'credit' && (
                        <div className="bg-slate-50 p-3 rounded mt-4 text-sm space-y-1">
                            <div className="flex justify-between text-gray-600">
                                <span>Paid Amount</span>
                                <span>₹{(bill.paidAmount || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-red-600">
                                <span>Balance In Bill</span>
                                <span>₹{(bill.totalAmount - (bill.paidAmount || 0)).toFixed(2)}</span>
                            </div>
                            {party && (
                                <div className="flex justify-between font-bold border-t border-gray-300 pt-1 mt-1">
                                    <span>Total Party Due</span>
                                    <span>₹{party.balance.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {localStorage.getItem('showQrCode') !== 'false' && localStorage.getItem('upiId') && (
                <div className="flex justify-center items-center mt-8 mb-8 border-t pt-8">
                    <div className="text-center">
                        <p className="font-bold text-gray-700 mb-2">Scan to Pay</p>
                        <QRCodeSVG
                            value={`upi://pay?pa=${localStorage.getItem('upiId')}&pn=${encodeURIComponent(profile.businessName)}&am=${bill.totalAmount.toFixed(2)}&cu=INR`}
                            size={160}
                            level="M"
                            includeMargin={true}
                        />
                        <p className="text-sm text-gray-600 mt-2">Amount: ₹{bill.totalAmount.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{localStorage.getItem('upiId')}</p>
                    </div>
                </div>
            )}

            <div className="mt-8 text-center text-gray-500 text-sm">
                <p>{localStorage.getItem('footerMessage') || 'Thank you for your business!'}</p>
            </div>
        </div>
    );
};

export default PrintBill;
