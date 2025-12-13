import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PrintModalProps {
    billId: number;
    onClose: () => void;
}

const PrintModal: React.FC<PrintModalProps> = ({ billId, onClose }) => {
    const navigate = useNavigate();

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

                <Button className="w-full mt-4" onClick={onClose}>Close</Button>
            </div>
        </div>
    );
};

export default PrintModal;
