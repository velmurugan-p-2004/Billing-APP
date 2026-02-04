import { BluetoothService } from './BluetoothService';
import { EscPos } from './EscPos';
import type { Bill, Profile } from '@/db/db';
import { db } from '@/db/db';
import { transliterateTamil } from './tamilTransliteration';
import { textToImage } from './textToImage';

export const PrinterService = {
    /**
     * Auto-connect on app launch (Vyapar-style)
     * Call this on app initialization
     */
    autoConnect: async (): Promise<boolean> => {
        return await BluetoothService.autoConnect();
    },

    /**
     * Print bill using template-based ESC/POS generation
     * Respects all template settings from localStorage
     */
    printBill: async (bill: Bill, profile: Profile): Promise<void> => {
        try {
            // Ensure connection
            const isConnected = await BluetoothService.isConnected();
            if (!isConnected) {
                const autoConnected = await BluetoothService.autoConnect();
                if (!autoConnected) {
                    throw new Error("Printer not connected. Please pair a printer first.");
                }
            }

            const encoder = new EscPos();
            
            // Get paper width from settings (default 58mm)
            const paperWidth = localStorage.getItem('printerPaperSize') || '58mm';
            const maxChars = paperWidth === '80mm' ? 48 : 32;

            // Logo (if enabled and exists) - Skip for now as requires image processing
            
            // Get font size settings
            const shopNameFontSize = localStorage.getItem('shopNameFontSize') || 'normal';
            const headerFontSize = localStorage.getItem('headerFontSize') || 'normal';
            const itemsFontSize = localStorage.getItem('itemsFontSize') || 'normal';
            const footerFontSize = localStorage.getItem('footerFontSize') || 'normal';
            const boldHeader = localStorage.getItem('boldHeader') !== 'false';
            const boldItems = localStorage.getItem('boldItems') === 'true';
            const boldFooter = localStorage.getItem('boldFooter') === 'true';

            // Shop Name
            if (localStorage.getItem('showShopName') !== 'false') {
                encoder.align('CENTER');
                if (boldHeader) encoder.bold(true);
                
                // Apply shop name specific size
                if (shopNameFontSize === 'xlarge') {
                    encoder.size('LARGE');
                    encoder.textLine(profile.businessName);
                    encoder.textLine(''); // Add extra line for xlarge
                } else if (shopNameFontSize === 'large') {
                    encoder.size('LARGE');
                    encoder.textLine(profile.businessName);
                } else if (shopNameFontSize === 'small') {
                    encoder.textLine(profile.businessName);
                } else {
                    // Normal size
                    encoder.textLine(profile.businessName);
                }
                
                encoder.size('NORMAL');
                if (boldHeader) encoder.bold(false);
            }

            // Business Description
            const description = localStorage.getItem('businessDescription');
            if (description) {
                if (boldHeader) encoder.bold(true);
                if (headerFontSize === 'small') {
                    // Use normal size for small
                    encoder.textLine(description);
                } else if (headerFontSize === 'large') {
                    encoder.size('LARGE').textLine(description).size('NORMAL');
                } else {
                    encoder.textLine(description);
                }
                if (boldHeader) encoder.bold(false);
            }

            // Address
            if (localStorage.getItem('showAddress') !== 'false') {
                if (boldHeader) encoder.bold(true);
                if (headerFontSize === 'large') encoder.size('LARGE');
                const addressLines = profile.address.split('\n');
                addressLines.forEach(line => encoder.textLine(line));
                encoder.size('NORMAL');
                if (boldHeader) encoder.bold(false);
            }

            // Phone
            if (localStorage.getItem('showPhone') !== 'false') {
                if (boldHeader) encoder.bold(true);
                if (headerFontSize === 'large') encoder.size('LARGE');
                encoder.textLine(profile.phone);
                encoder.size('NORMAL');
                if (boldHeader) encoder.bold(false);
            }

            // Separator
            encoder.bold(true).textLine('='.repeat(maxChars)).bold(false);

            // Bill Meta
            encoder.align('LEFT');
            if (headerFontSize === 'large') encoder.size('LARGE');
            const billDate = new Date(bill.date);
            const dateStr = billDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = billDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            encoder.textLine(`Bill: ${bill.billNo}`.padEnd(maxChars - dateStr.length) + dateStr);
            encoder.textLine(`Time: ${timeStr}`);

            // Customer Name
            if (bill.customerName) {
                encoder.textLine(`Customer: ${bill.customerName}`);
            }
            encoder.size('NORMAL');

            // Credit Bill indicator
            if (bill.paymentMode === 'credit') {
                encoder.align('CENTER')
                    .bold(true)
                    .textLine('CASH/CREDIT BILL')
                    .bold(false)
                    .align('LEFT');
            }

            // Separator
            encoder.bold(true).textLine('='.repeat(maxChars)).bold(false);

            // Items Header
            const showMrp = localStorage.getItem('showMrp') !== 'false';
            const qtyW = 4;
            const mrpW = showMrp ? 6 : 0;
            const amtW = 7;
            const nameW = maxChars - qtyW - mrpW - amtW - 2;

            let header = 'Qty '.padEnd(qtyW) + 'Item'.padEnd(nameW);
            if (showMrp) header += 'MRP'.padStart(mrpW);
            header += 'Price'.padStart(amtW);
            encoder.bold(true);
            if (itemsFontSize === 'large') encoder.size('LARGE');
            encoder.textLine(header);
            encoder.size('NORMAL').bold(false);
            
            // Add separator line below header
            encoder.textLine('-'.repeat(maxChars));

            // Items
            let totalQty = 0;
            let totalMrp = 0;
            let subTotal = 0;

            bill.items.forEach(item => {
                // Apply items font size
                if (boldItems) encoder.bold(true);
                if (itemsFontSize === 'large') {
                    encoder.size('LARGE');
                } else if (itemsFontSize === 'small') {
                    encoder.size('NORMAL'); // ESC/POS doesn't have smaller than normal
                }
                
                const qty = item.quantity.toString().padEnd(qtyW);
                // Use englishName for printing, fallback to transliterated name
                let name = item.englishName || transliterateTamil(item.name);
                if (item.unit) name += ` (${item.unit})`;
                if (name.length > nameW) name = name.substring(0, nameW - 2) + '..';
                name = name.padEnd(nameW);
                
                const amt = (item.price * item.quantity).toFixed(0).padStart(amtW);
                
                let line = qty + name;
                if (showMrp) {
                    line += item.mrp.toString().padStart(mrpW);
                }
                line += amt;
                
                encoder.textLine(line);
                encoder.size('NORMAL');
                if (boldItems) encoder.bold(false);

                totalQty += item.quantity;
                totalMrp += item.mrp * item.quantity;
                subTotal += item.price * item.quantity;
            });

            // Totals row
            encoder.bold(true).textLine('='.repeat(maxChars));
            if (itemsFontSize === 'large') encoder.size('LARGE');
            let totalLine = totalQty.toString().padEnd(qtyW) + 'Total'.padEnd(nameW);
            if (showMrp) totalLine += totalMrp.toFixed(0).padStart(mrpW);
            totalLine += subTotal.toFixed(0).padStart(amtW);
            encoder.textLine(totalLine);
            encoder.size('NORMAL');
            encoder.textLine('='.repeat(maxChars)).bold(false);

            // Discount
            if (Number(bill.discount) > 0) {
                const discountLine = 'Discount'.padEnd(maxChars - 10) + `Rs ${bill.discount}`.padStart(10);
                if (itemsFontSize === 'large') encoder.size('LARGE');
                encoder.textLine(discountLine);
                encoder.size('NORMAL');
            }

            // Grand Total
            encoder.bold(true).size('LARGE').align('CENTER');
            encoder.textLine(`GRAND TOTAL: Rs ${bill.totalAmount.toFixed(0)}`);
            encoder.size('NORMAL').bold(false).align('LEFT');

            // Credit details
            if (bill.paymentMode === 'credit') {
                encoder.bold(true).textLine('='.repeat(maxChars)).bold(false);
                const paidLine = 'Paid Now'.padEnd(maxChars - 10) + `Rs${(bill.paidAmount || 0).toFixed(0)}`.padStart(10);
                if (itemsFontSize === 'large') encoder.size('LARGE');
                encoder.textLine(paidLine);
                encoder.size('NORMAL');
                
                encoder.bold(true);
                const dueLine = 'Bill Due'.padEnd(maxChars - 10) + `Rs${(bill.totalAmount - (bill.paidAmount || 0)).toFixed(0)}`.padStart(10);
                if (itemsFontSize === 'large') encoder.size('LARGE');
                encoder.textLine(dueLine);
                encoder.size('NORMAL');
                encoder.bold(false);
                
                // Previous Balance and Net Balance (total outstanding for party)
                if (bill.partyId) {
                    const partyBills = await db.bills
                        .where('partyId')
                        .equals(bill.partyId)
                        .toArray();
                    
                    // Get all manual transactions for this party
                    const partyTransactions = await db.partyTransactions
                        .where('partyId')
                        .equals(bill.partyId)
                        .toArray();
                    
                    // Calculate previous balance from credit bills (excluding current bill)
                    const billsBalance = partyBills
                        .filter(b => b.paymentMode === 'credit' && b.id !== bill.id)
                        .reduce((sum, b) => sum + (b.totalAmount - (b.paidAmount || 0)), 0);
                    
                    // Calculate balance from manual transactions (payments reduce, charges increase)
                    const transactionsBalance = partyTransactions.reduce((sum, t) => {
                        if (t.type === 'PAYMENT') {
                            return sum - t.amount;
                        } else if (t.type === 'CHARGE') {
                            return sum + t.amount;
                        }
                        return sum;
                    }, 0);
                    
                    // Total previous balance = bills balance + transactions balance
                    const previousBalance = billsBalance + transactionsBalance;
                    
                    // Calculate net balance (including current bill)
                    const netBalance = previousBalance + (bill.totalAmount - (bill.paidAmount || 0));
                    
                    // Dashed separator
                    encoder.textLine('-'.repeat(maxChars));
                    
                    // Previous Balance
                    const prevBalanceLine = 'Previous Balance'.padEnd(maxChars - 10) + `Rs${previousBalance.toFixed(0)}`.padStart(10);
                    if (itemsFontSize === 'large') encoder.size('LARGE');
                    encoder.textLine(prevBalanceLine);
                    encoder.size('NORMAL');
                    
                    // Solid separator
                    encoder.bold(true).textLine('='.repeat(maxChars));
                    
                    // Net Balance (bold)
                    const netBalanceLine = 'Net Balance'.padEnd(maxChars - 10) + `Rs${netBalance.toFixed(0)}`.padStart(10);
                    if (itemsFontSize === 'large') encoder.size('LARGE');
                    encoder.textLine(netBalanceLine);
                    encoder.size('NORMAL');
                    encoder.bold(false);
                }
            }

            // Savings
            if (localStorage.getItem('showSavings') !== 'false') {
                const savings = bill.items.reduce((acc, i) => acc + ((i.mrp - i.price) * i.quantity), 0) + (bill.discount || 0);
                if (savings > 0) {
                    encoder.feed(1).align('CENTER').bold(true);
                    encoder.textLine(`You Saved: Rs${savings.toFixed(0)}`);
                    encoder.bold(false);
                }
            }

            // QR Code (if enabled)
            const upiId = localStorage.getItem('upiId');
            if (localStorage.getItem('showQrCode') !== 'false' && upiId) {
                encoder.feed(1).align('CENTER');
                encoder.textLine('Scan to Pay');
                
                const qrData = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(profile.businessName)}&am=${bill.totalAmount.toFixed(2)}&cu=INR`;
                encoder.printQRCode(qrData);
                
                encoder.textLine(`Rs${bill.totalAmount.toFixed(0)}`);
            }

            // Footer
            if (localStorage.getItem('showFooter') !== 'false') {
                encoder.feed(1).align('CENTER');
                
                const footerMessage = localStorage.getItem('footerMessage') || '*** Thank You ***';
                const footerAsImage = localStorage.getItem('footerAsImage') === 'true';
                
                if (footerAsImage) {
                    // Generate footer as image
                    const paperWidth = localStorage.getItem('printerPaperSize') || '58mm';
                    const imageWidth = paperWidth === '80mm' ? 576 : 384; // 72mm and 48mm printable width (8 dots/mm)
                    const fontSize = parseInt(localStorage.getItem('footerImageFontSize') || '16');
                    const backgroundColor = localStorage.getItem('footerImageBg') || '#FFFFFF';
                    const textColor = localStorage.getItem('footerImageText') || '#000000';
                    
                    // Create image from text
                    const base64Image = textToImage({
                        text: footerMessage,
                        width: imageWidth,
                        fontSize: fontSize,
                        backgroundColor: backgroundColor,
                        textColor: textColor,
                        bold: boldFooter,
                        padding: 10
                    });
                    
                    // Print image
                    await encoder.printImageFromBase64(base64Image);
                } else {
                    // Print footer as text (existing behavior)
                    if (boldFooter) encoder.bold(true);
                    if (footerFontSize === 'large') {
                        encoder.size('LARGE');
                    } else if (footerFontSize === 'small') {
                        encoder.size('NORMAL');
                    }
                    encoder.textLine(footerMessage);
                    encoder.size('NORMAL');
                    if (boldFooter) encoder.bold(false);
                }
            }

            // Cut paper
            encoder.feed(2).cut();

            const bytes = encoder.getBytes();
            await BluetoothService.write(bytes);

            console.log('Receipt printed successfully');

        } catch (error) {
            console.error("Print Error:", error);
            throw error;
        }
    }
};
