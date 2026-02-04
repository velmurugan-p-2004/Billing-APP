import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Smartphone, Bluetooth, CheckCircle, Usb } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BluetoothService } from '@/utils/BluetoothService';
import { db } from '@/db/db';
import { PrinterService } from '@/utils/PrinterService';

interface PrintModalProps {
    billId: number;
    onClose: () => void;
}

const PrintModal: React.FC<PrintModalProps> = ({ billId, onClose }) => {
    const navigate = useNavigate();
    const [isPrinterConnected, setIsPrinterConnected] = useState(false);
    const [printerName, setPrinterName] = useState('');
    const [connectionType, setConnectionType] = useState<'bluetooth' | 'usb' | null>(null);
    const [isPrinting, setIsPrinting] = useState(false);

    useEffect(() => {
        checkPrinterConnection();
    }, []);

    const checkPrinterConnection = async () => {
        try {
            // Check Bluetooth connection
            const btConnected = await BluetoothService.isConnected();
            if (btConnected) {
                setIsPrinterConnected(true);
                setConnectionType('bluetooth');
                const savedName = localStorage.getItem('bluetoothDeviceName');
                setPrinterName(savedName || 'Bluetooth Printer');
                return;
            }

            // Check USB/System printer configuration
            const printerConnectionType = localStorage.getItem('printerConnectionType');
            const defaultPrinterType = localStorage.getItem('defaultPrinterType');
            
            if (printerConnectionType === 'usb' && defaultPrinterType && defaultPrinterType !== 'ask') {
                setIsPrinterConnected(true);
                setConnectionType('usb');
                setPrinterName('USB / System Printer');
                return;
            }

            setIsPrinterConnected(false);
            setConnectionType(null);
        } catch (error) {
            console.error('Error checking printer connection:', error);
            setIsPrinterConnected(false);
            setConnectionType(null);
        }
    };

    const handleDirectPrint = async () => {
        setIsPrinting(true);
        try {
            if (connectionType === 'bluetooth') {
                // Bluetooth Direct Print
                const bill = await db.bills.get(billId);
                if (!bill) {
                    alert('Bill not found');
                    return;
                }

                const profile = bill.profileId 
                    ? await db.profiles.get(bill.profileId)
                    : await db.profiles.toCollection().first();

                if (!profile) {
                    alert('Profile not found');
                    return;
                }

                await PrinterService.printBill(bill, profile);

                alert('✅ Receipt printed successfully!');
                onClose();
            } else if (connectionType === 'usb') {
                // USB/System Direct Print via iframe
                const defaultPrinterType = localStorage.getItem('defaultPrinterType');
                const template = defaultPrinterType === 'a4' ? 'professional' : 'simple';
                
                // Open print page in hidden iframe and trigger print
                const printUrl = `/print/${billId}?template=${template}`;
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
                
                iframe.onload = () => {
                    try {
                        // Wait a bit for content to render
                        setTimeout(() => {
                            iframe.contentWindow?.print();
                            // Clean up after print dialog closes
                            setTimeout(() => {
                                document.body.removeChild(iframe);
                            }, 1000);
                        }, 500);
                    } catch (error) {
                        console.error('Print error:', error);
                        document.body.removeChild(iframe);
                        // Fallback to navigation
                        navigate(`/print/${billId}?template=${template}&autoprint=true`);
                    }
                };
                
                iframe.src = printUrl;
                
                // Close modal immediately
                setTimeout(() => {
                    onClose();
                }, 800);
            }
        } catch (error) {
            console.error('Print error:', error);
            alert('❌ Print failed. Please try again or check printer connection.');
        } finally {
            setIsPrinting(false);
        }
    };

    const handlePrint = (template: string) => {
        // Open in new window or navigate?
        // Navigate is better for PWA context, but new window allows keeping POS open.
        // In mobile PWA, tabs are tricky. Let's use navigate.
        navigate(`/print/${billId}?template=${template}&autoprint=true`);
    };

    const connectBluetooth = async () => {
        try {
            // Experimental Web Bluetooth Logic
            // This is very specific to printer device UUIDs.
            // Using a generic service UUID often found in thermal printers.
            const device = await (navigator as any).bluetooth.requestDevice({
                filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }]
            });
            const server = await device.gatt.connect();
            const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

            const encoder = new TextEncoder();
            const text = "TEST PRINT\n\nHello World\n\n\n";
            await characteristic.writeValue(encoder.encode(text));
            alert("Sent to Printer!");
        } catch (e) {
            console.error(e);
            alert("Bluetooth Print Failed or Cancelled. Ensure printer is on and paired.");
        }
    };

    // Auto-redirect if default printer is set
    React.useEffect(() => {
        const defaultPrinter = localStorage.getItem('defaultPrinterType');
        if (defaultPrinter && defaultPrinter !== 'ask') {
            handlePrint(defaultPrinter === 'a4' ? 'professional' : 'simple');
        }
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-sm space-y-4">
                <h2 className="text-xl font-bold">Print Receipt</h2>

                {isPrinterConnected ? (
                    // Connected Printer View
                    <div className="space-y-4">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2 text-green-700 mb-2">
                                <CheckCircle className="w-5 h-5" />
                                <span className="font-semibold">Printer Connected</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                {connectionType === 'bluetooth' ? (
                                    <Bluetooth className="w-4 h-4" />
                                ) : (
                                    <Usb className="w-4 h-4" />
                                )}
                                <span>{printerName}</span>
                            </div>
                        </div>

                        <Button
                            className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={handleDirectPrint}
                            disabled={isPrinting}
                        >
                            {isPrinting ? (
                                <>
                                    <span className="animate-spin mr-2">⏳</span>
                                    Printing...
                                </>
                            ) : (
                                <>
                                    <Printer className="w-5 h-5 mr-2" />
                                    Print Now
                                </>
                            )}
                        </Button>

                        <div className="border-t pt-3">
                            <p className="text-xs text-gray-500 mb-2">Other print options:</p>
                            <div className="space-y-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full justify-start"
                                    onClick={() => handlePrint('simple')}
                                >
                                    <Smartphone className="w-4 h-4 mr-2" />
                                    Thermal Print (Browser)
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full justify-start"
                                    onClick={() => handlePrint('professional')}
                                >
                                    <Printer className="w-4 h-4 mr-2" />
                                    A4 Professional Invoice
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Not Connected View
                    <div className="space-y-4">
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-sm text-amber-800">
                                <Bluetooth className="w-4 h-4 inline mr-1" />
                                No printer connected. Use browser print or connect a printer in Settings.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => handlePrint('simple')}
                            >
                                <Smartphone className="w-4 h-4 mr-2" />
                                Thermal Print (Browser)
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => handlePrint('professional')}
                            >
                                <Printer className="w-4 h-4 mr-2" />
                                A4 Professional Invoice
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full justify-start text-blue-600"
                                onClick={connectBluetooth}
                            >
                                Test Bluetooth Direct (Experimental)
                            </Button>
                        </div>
                    </div>
                )}

                <Button variant="outline" className="w-full mt-4" onClick={onClose}>Close</Button>
            </div>
        </div>
    );
};

export default PrintModal;
