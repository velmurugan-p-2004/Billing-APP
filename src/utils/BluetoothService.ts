export interface BluetoothDevice {
    name: string;
    address: string; // MAC Address
    id?: string;
    class?: number;
}

export const BluetoothService = {
    isEnabled: async (): Promise<boolean> => {
        return new Promise((resolve) => {
            if (!(window as any).bluetoothSerial) {
                resolve(false);
                return;
            }
            (window as any).bluetoothSerial.isEnabled(
                () => resolve(true),
                () => resolve(false)
            );
        });
    },

    enable: async (): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (!(window as any).bluetoothSerial) return reject("Plugin not available");
            (window as any).bluetoothSerial.enable(resolve, reject);
        });
    },

    list: async (): Promise<BluetoothDevice[]> => {
        return new Promise((resolve, reject) => {
            if (!(window as any).bluetoothSerial) return reject("Plugin not available");
            (window as any).bluetoothSerial.list(resolve, reject);
        });
    },

    discoverUnpaired: async (): Promise<BluetoothDevice[]> => {
        return new Promise((resolve, reject) => {
            if (!(window as any).bluetoothSerial) return reject("Plugin not available");
            (window as any).bluetoothSerial.discoverUnpaired(resolve, reject);
        });
    },

    connect: async (address: string): Promise<void> => {
        // Ensure permissions are granted before attempting connection
        await BluetoothService.requestPermissions();

        return new Promise((resolve, reject) => {
            if (!(window as any).bluetoothSerial) return reject("Plugin not available");

            // First try secure connection
            (window as any).bluetoothSerial.connect(address, () => {
                console.log("Connected securely");
                resolve();
            }, (err: any) => {
                console.warn("Secure connection failed, trying insecure...", err);
                // Fallback to insecure connection
                (window as any).bluetoothSerial.connectInsecure(address, () => {
                    console.log("Connected insecurely");
                    resolve();
                }, (err2: any) => {
                    reject(err2);
                });
            });
        });
    },

    disconnect: async (): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (!(window as any).bluetoothSerial) return resolve(); // Already disconnected conceptually
            (window as any).bluetoothSerial.disconnect(resolve, reject);
        });
    },

    isConnected: async (): Promise<boolean> => {
        return new Promise((resolve) => {
            if (!(window as any).bluetoothSerial) return resolve(false);
            (window as any).bluetoothSerial.isConnected(
                () => resolve(true),
                () => resolve(false)
            );
        });
    },

    write: async (data: string | Uint8Array): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (!(window as any).bluetoothSerial) return reject("Plugin not available");
            (window as any).bluetoothSerial.write(data, resolve, reject);
        });
    },

    requestPermissions: async (): Promise<void> => {
        return new Promise((resolve) => {
            const permissions = (window as any).cordova?.plugins?.permissions;
            if (!permissions) {
                resolve();
                return;
            }

            // Get Android SDK version
            const sdkVersion = (window as any).device?.version
                ? parseInt((window as any).device.version.split('.')[0])
                : 0;

            let list: string[] = [];

            // Android 12+ (API 31+) - Use new Bluetooth permissions
            if (sdkVersion >= 12) {
                list = [
                    'android.permission.BLUETOOTH_SCAN',
                    'android.permission.BLUETOOTH_CONNECT'
                ];
            } else {
                // Android 11 and below - Use Location permissions
                list = [
                    'android.permission.ACCESS_FINE_LOCATION',
                    'android.permission.ACCESS_COARSE_LOCATION'
                ];
            }

            permissions.requestPermissions(list, () => {
                console.log(`Permissions granted for Android ${sdkVersion}`);
                resolve();
            }, (e: any) => {
                console.warn("Permission request error", e);
                resolve();
            });
        });
    },

    /**
     * Auto-connect to saved printer (Vyapar-style)
     * Attempts silent background connection to previously paired printer
     */
    autoConnect: async (): Promise<boolean> => {
        const savedMac = localStorage.getItem('saved_printer_mac');
        if (!savedMac) {
            console.log('No saved printer found');
            return false;
        }

        try {
            console.log('Attempting auto-connect to:', savedMac);
            await BluetoothService.connect(savedMac);
            console.log('Auto-connected successfully');
            return true;
        } catch (error) {
            console.warn('Auto-connect failed:', error);
            // Clear invalid MAC address
            localStorage.removeItem('saved_printer_mac');
            localStorage.removeItem('bluetoothDeviceName');
            return false;
        }
    },

    /**
     * Save printer for auto-connection
     */
    savePrinter: (address: string, name: string) => {
        localStorage.setItem('saved_printer_mac', address);
        localStorage.setItem('bluetoothDeviceName', name);
    }
};
