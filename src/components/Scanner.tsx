import React, { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface ScannerProps {
    onScan: (decodedText: string) => void;
    onClose: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onClose }) => {
    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
        );

        scanner.render(
            (decodedText) => {
                onScan(decodedText);
                scanner.clear();
            },
            (errorMessage) => {
                // parse error, ignore it.
            }
        );

        return () => {
            scanner.clear().catch(error => {
                console.error("Failed to clear html5-qrcode scanner. ", error);
            });
        };
    }, [onScan]);

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80">
            <div className="bg-white p-4 rounded-lg w-full max-w-md relative">
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                >
                    X
                </button>
                <div id="reader" className="w-full"></div>
                <p className="text-center mt-2 text-sm text-gray-500">Point camera at a barcode</p>
            </div>
        </div>
    );
};

export default Scanner;
