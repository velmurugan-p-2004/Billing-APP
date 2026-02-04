import { PrinterService } from './PrinterService';
import { BluetoothService } from './BluetoothService';

/**
 * Initializer for Bluetooth Printer (Vyapar-style Auto-Connect)
 * Call this once when your app launches
 */
export const initializePrinter = async () => {
    try {
        console.log('Initializing Bluetooth Printer...');

        // Request permissions first
        await BluetoothService.requestPermissions();

        // Check if Bluetooth is enabled
        const isEnabled = await BluetoothService.isEnabled();
        if (!isEnabled) {
            console.log('Bluetooth is disabled, attempting to enable...');
            try {
                await BluetoothService.enable();
            } catch (error) {
                console.warn('Could not enable Bluetooth automatically:', error);
                return false;
            }
        }

        // Attempt auto-connect to saved printer
        const connected = await PrinterService.autoConnect();

        if (connected) {
            console.log('✅ Printer auto-connected successfully');
            return true;
        } else {
            console.log('ℹ️ No saved printer or connection failed');
            return false;
        }

    } catch (error) {
        console.error('Printer initialization error:', error);
        return false;
    }
};

/**
 * Get printer connection status
 */
export const isPrinterReady = async (): Promise<boolean> => {
    try {
        return await BluetoothService.isConnected();
    } catch {
        return false;
    }
};

/**
 * Example usage in your App.tsx or main component:
 * 
 * useEffect(() => {
 *     initializePrinter();
 * }, []);
 */
