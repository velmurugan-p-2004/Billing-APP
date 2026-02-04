# Bluetooth Printer Connection Guide - Seematti Billing (Mobile App)

## 📱 Overview
This document explains how to connect and use Bluetooth thermal printers with the Seematti Billing mobile application (Android/iOS).

---

## 🏗️ Architecture

### Technology Stack
- **Platform**: Capacitor (Hybrid Mobile App)
- **Bluetooth Plugin**: `cordova-plugin-bluetooth-serial` v0.4.7
- **Permissions Plugin**: `cordova-plugin-android-permissions` v1.1.5
- **Framework**: React + TypeScript
- **Database**: Dexie (IndexedDB)

### Key Files
```
src/utils/
├── BluetoothService.ts       # Bluetooth connection manager
├── PrinterService.ts         # Receipt printing logic
├── PrinterInitializer.ts     # Auto-connect on app launch
└── EscPos.ts                 # ESC/POS command encoder
```

---

## 🔌 How Bluetooth Printing Works

### 1. **Initialization (App Launch)**
When the app starts ([App.tsx](src/App.tsx#L28)):
```typescript
useEffect(() => {
    initializePrinter();  // Auto-connects to saved printer
}, []);
```

The initialization process ([PrinterInitializer.ts](src/utils/PrinterInitializer.ts)):
1. Requests Bluetooth permissions
2. Checks if Bluetooth is enabled
3. Attempts to auto-connect to previously paired printer (Vyapar-style)
4. Returns success/failure status

### 2. **Pairing a Printer**
Users can pair printers from [Settings](src/pages/Settings.tsx):

**Steps:**
1. Go to Settings → Printer section
2. Click "Pair Device" button
3. App requests permissions (Android 12+ needs `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT`)
4. Shows list of paired Bluetooth devices
5. Click "Scan for Devices" to discover unpaired printers
6. Select your printer from the list
7. App attempts connection (secure → insecure fallback)
8. On success, saves MAC address for auto-reconnection

**Connection Code** ([BluetoothService.ts](src/utils/BluetoothService.ts#L46-L67)):
```typescript
connect: async (address: string): Promise<void> => {
    await BluetoothService.requestPermissions();
    
    return new Promise((resolve, reject) => {
        // First try secure connection
        bluetoothSerial.connect(address, () => {
            console.log("Connected securely");
            resolve();
        }, (err) => {
            // Fallback to insecure connection
            bluetoothSerial.connectInsecure(address, () => {
                console.log("Connected insecurely");
                resolve();
            }, reject);
        });
    });
}
```

### 3. **Auto-Connection**
On subsequent app launches, the app automatically connects to the saved printer:

```typescript
autoConnect: async (): Promise<boolean> => {
    const savedMac = localStorage.getItem('saved_printer_mac');
    if (!savedMac) return false;
    
    try {
        await BluetoothService.connect(savedMac);
        return true;
    } catch (error) {
        // Clear invalid MAC address
        localStorage.removeItem('saved_printer_mac');
        return false;
    }
}
```

### 4. **Printing a Receipt (Immediate Print on Bill Save)**

When a user generates a bill in the Billing section, it **automatically prints immediately**. Here's the flow:

**Step 1: Bill Generation** ([Billing.tsx](src/pages/Billing.tsx#L395-L406))
```typescript
await handleSaveBill();

// Check user's default printer preference
const defaultPrinter = localStorage.getItem('defaultPrinterType');

if (defaultPrinter && defaultPrinter !== 'ask') {
    // Auto-print: Navigate to print page with autoprint=true
    const template = defaultPrinter === 'a4' ? 'professional' : 'simple';
    navigate(`/print/${billId}?template=${template}&autoprint=true`);
} else {
    // Show modal to ask user which printer to use
    setShowPrintModal(true);
}
```

**Step 2: Auto-Print Trigger** ([PrintBill.tsx](src/pages/PrintBill.tsx#L28-L42))
```typescript
useEffect(() => {
    if (bill && profile && autoPrint && !hasPrinted.current) {
        hasPrinted.current = true;
        setTimeout(() => {
            window.print(); // Triggers browser print dialog
            
            // Auto-return to billing after 5 seconds
            setTimeout(() => {
                navigate('/billing');
            }, 5000);
        }, 500);
    }
}, [bill, profile, autoPrint]);
```

**Immediate Print Behavior:**
- ✅ **If thermal printer is set**: Bill prints immediately via browser print dialog (connects to paired thermal printer)
- ✅ **If A4 printer is set**: Professional invoice prints via system printer
- ✅ **If "ask every time" is set**: Modal appears with printer options
- ✅ **Auto-return**: After printing, app returns to billing screen in 5 seconds

**Print Process for Bluetooth Thermal** ([PrinterService.ts](src/utils/PrinterService.ts#L36-L126)):
1. Check if printer is connected
2. If not, attempt auto-connect
3. Build receipt using ESC/POS commands:
   - Header (shop name, address, phone)
   - Bill metadata (bill number, date)
   - Items table (name, quantity, price)
   - Totals section (subtotal, discount, grand total)
   - Footer (thank you message)
4. Convert to byte array
5. Send to printer via Bluetooth

---

## 🛠️ ESC/POS Commands

The app uses standard ESC/POS thermal printer commands ([EscPos.ts](src/utils/EscPos.ts)):

| Command | Hex Codes | Purpose |
|---------|-----------|---------|
| Initialize | `[ESC, 0x40]` | Reset printer |
| Bold ON | `[ESC, 0x45, 0x01]` | Enable bold text |
| Bold OFF | `[ESC, 0x45, 0x00]` | Disable bold text |
| Align Left | `[ESC, 0x61, 0x00]` | Left align |
| Align Center | `[ESC, 0x61, 0x01]` | Center align |
| Align Right | `[ESC, 0x61, 0x02]` | Right align |
| Large Text | `[ESC, 0x21, 0x10]` | 2x height |
| Normal Text | `[ESC, 0x21, 0x00]` | Normal size |
| Cut Paper | `[GS, 0x56, 0x01]` | Partial cut |
| Line Feed | `[0x0A]` | New line |

**Example Usage:**
```typescript
const encoder = new EscPos();
encoder
    .align('CENTER')
    .bold(true)
    .size('LARGE')
    .textLine('Seematti Billing')
    .size('NORMAL')
    .bold(false)
    .textLine('Thank You!')
    .cut();

const bytes = encoder.getBytes();
await BluetoothService.write(bytes);
```

---

## 📋 User Instructions

### For Android Users

#### **Method 1: Bluetooth Direct (Recommended)**

1. **Enable Bluetooth & Location**
   - Turn ON Bluetooth in phone settings
   - Turn ON Location/GPS (required for Android to scan Bluetooth devices)

2. **Grant App Permissions**
   - Android 12+: App will request "Nearby Devices" permission
   - Android 11 and below: App will request "Location" permission
   - Go to: **Settings → Apps → Seematti Billing → Permissions**
   - Enable all requested permissions

3. **Pair Printer in App**
   - Open Seematti Billing app
   - Go to **Settings** tab
   - Scroll to **Printer Settings**
   - Click **"Pair Device"** button
   - Click **"Scan for Devices"** if your printer doesn't appear
   - Select your printer (e.g., "RPP02N", "MTP-2", "InnerPrinter")
   - Wait for "✅ Connected" message

4. **Set Default Printer Type**
   - In Settings, under "Default Printer Type"
   - Select **"Thermal"** for 58mm/80mm receipt printer
   - Select **"A4"** for professional invoice printer
   - Select **"Ask every time"** to choose each time

5. **Print a Test Bill**
   - Go to **Billing** tab
   - Add items and save a bill
   - **Bill prints immediately** after clicking "Save Bill"
   - Browser print dialog opens automatically
   - Select your paired printer and confirm
   - Receipt prints on thermal printer
   - App returns to billing screen after 5 seconds

#### **Method 2: System Print (USB/Bluetooth via RawBT)**

See [PRINTER_SETUP.md](PRINTER_SETUP.md) for detailed instructions using RawBT service.

---

### For iOS Users

**Note:** iOS does not support direct Bluetooth serial connections for thermal printers due to Apple's restrictions.

**Alternative Methods:**
1. Use AirPrint-compatible thermal printers
2. Use WiFi-enabled thermal printers
3. Use browser print dialog (for supported printers)

---

## 🐛 Troubleshooting

### Issue 1: "Printer Not Found"
**Symptoms:** Device list is empty when clicking "Pair Device"

**Solutions:**
- ✅ Turn Bluetooth OFF and ON again
- ✅ Turn ON Location/GPS (mandatory for Android)
- ✅ Restart the printer
- ✅ Check app permissions: Settings → Apps → Seematti Billing → Permissions
- ✅ Try "Scan for Devices" button

### Issue 2: "Connection Failed"
**Symptoms:** "Connection Failed. Ensure device is ON..." error

**Solutions:**
- ✅ Ensure printer is powered ON and fully charged
- ✅ Move phone closer to printer (within 3 meters)
- ✅ Unpair device from Android Bluetooth Settings
- ✅ Only pair through the Seematti app
- ✅ Some printers require a P or "Print Dialog Closes Immediately"
**Symptoms:** No error, but printer doesn't print / Print dialog appears and closes

**Solutions:**
- ✅ Check if printer has paper
- ✅ Restart the printer
- ✅ Disconnect and reconnect in Settings
- ✅ Check printer battery level
- ✅ Try printing a test page from printer's hardware button
- ✅ **For fast dialog closing**: Bill is saved successfully but print dialog closes too fast
  - This is normal behavior with auto-print enabled
  - Browser automatically sends to default printer
  - If you need more time, go to Settings → "Ask every time"
- ✅ **Set printer as default** in Android Settings → Printing → RawBT → Set as Default → Enable all

### Issue 4: "Nothing Prints"
**Symptoms:** No error, but printer doesn't print

**Solutions:**
- ✅ Check if printer has paper
- ✅ Restart the printer
- ✅ Disconnect and reconnect in Settings
- ✅ Check printer battery level
- ✅ Try printing a test page from printer's hardware button

### Issue 5: "Garbage Characters" (e.g., %&^%#)
**Symptoms:** Random symbols instead of text

**Solutions:**
- ✅ This usually means incompatible ESC/POS commands
- ✅ Switch to "System Print" method using RawBT (see [PRINTER_SETUP.md](PRINTER_SETUP.md))
- ✅ Contact support with your printer model

### Issue 6: "Auto-Connect Doesn't Work"
**Symptoms:** Need to manually connect every time

**Solutions:**
- ✅ Ensure you clicked "Pair Device" in Settings (not Android Settings)
- ✅ Check if MAC address is saved: `localStorage.getItem('saved_printer_mac')`
- ✅ Some Android power-saving modes kill Bluetooth connections
- ✅ Disable battery optimization for Seematti Billing app

---

## 🔒 Permissions Explained

### Android 12+ (API 31+)
Required permissions ([BluetoothService.ts](src/utils/BluetoothService.ts#L94-L121)):
- `BLUETOOTH_SCAN` - Discover nearby Bluetooth devices
- `BLUETOOTH_CONNECT` - Connect to paired devices

### Android 11 and Below (API 30 and below)
Required permissions:
- `ACCESS_FINE_LOCATION` - Required to scan for Bluetooth devices
- `ACCESS_COARSE_LOCATION` - Required to scan for Bluetooth devices

**Why Location?** Android requires location permission for Bluetooth scanning because Bluetooth can be used to determine physical location.

---

## 🖨️ Supported Printers

The app uses standard ESC/POS commands, which are supported by most thermal printers:

### ✅ Tested & Working
- RPP02N (58mm)
- MTP-2 (58mm/80mm)
- InnerPrinter (58mm)
- BlueBamboo P25 (58mm)
- Zebra Mobile Printers

### ⚠️ May Require Additional Setup
- Star Micronics (requires StarPRNT SDK)
- Epson TM series (may  - Immediate Print on Bill Generation

```
User Clicks "Save Bill"
      ↓
Billing.tsx (handleSaveBill)
      ↓
Bill saved to database
      ↓
Check Default Printer Setting
      ├─ "thermal" or "a4" → Navigate to /print/:billId?autoprint=true
      └─ "ask" → Show PrintModal
      ↓
PrintBill.tsx renders receipt HTML
      ↓
Auto-print triggered (autoPrint=true)
      ↓
500ms delay → window.print()
      ↓
Browser Print Dialog Opens
      ↓
User selects paired Bluetooth printer
      ↓
Browser sends print job
      ↓
Android System Print Service / RawBT
   OR
Bluetooth Serial (direct connection)
      ↓
ESC/POS commands sent to printer
      ↓
🖨️ Receipt prints on Thermal Printer
      ↓
5 seconds delay
      ↓
Auto-navigate back to /billing
      ↓
Ready for next bill
```

**Alternative Flow for Direct Bluetooth:**
```
PrinterService.printReceipt()
      ↓
Check Bluetooth connection
      ↓
BluetoothService.isConnected()
      ├─ Connected → Continue
      └─ Not connected → Auto-connect to saved printer
      ↓
Build ESC/POS commands (EscPos.ts)
      ├─ Header (shop name, address)
      ├─ Bill metadata (number, date)
      ├─ Items table
      ├─ Totals
      └─ Footer
      ↓
Convert to byte array (Uint8Array)
      ↓
BluetoothService.write(bytes)
      ↓
cordova-plugin-bluetooth-serial
      ↓
Android Bluetooth Serial Port API
      ↓
🖨️ Thermal Printer (ESC/POS)nds (EscPos.ts)
      ↓
Convert to byte array
      ↓
BluetoothService.write(bytes)
      ↓
cordova-plugin-bluetooth-serial
      ↓
Android Bluetooth API
      ↓
🖨️ Thermal Printer
```

---

## 🔧 Developer Notes

### Modifying Print Layout
Edit [PrinterService.ts](src/utils/PrinterService.ts#L36-L126) to customize receipt format:
```typescript
// Header
encoder.align('CENTER')
    .bold(true)
    .size('LARGE')
    .textLine(data.shopName);

// Items
data.items.forEach(item => {
    encoder.textLine(`${item.name} x${item.qty} = ${item.price}`);
});

// Footer
encoder.align('CENTER')
    .textLine("Thank You!");
```

### Adding New ESC/POS Commands
Add to [EscPos.ts](src/utils/EscPos.ts#L1-L25):
```typescript
export const Commands = {
    // ... existing commands
    TXT_UNDERLINE_ON: [ESC, 0x2D, 0x01],
    TXT_UNDERLINE_OFF: [ESC, 0x2D, 0x00],
};
```

### Testing Without Printer
Use Chrome DevTools to simulate Bluetooth:
1. Open Chrome DevTools
2. Go to Settings → Experiments
3. Enable "Web Bluetooth Test"
4. Use `chrome://bluetooth-internals/` for debugging

---

## 📞 Support

### Common Printer Models & Settings

| Printer Model | Connection Type | Paper Size | Charset |
|---------------|----------------|------------|---------|
| RPP02N | Bluetooth SPP | 58mm | GB18030 |
| MTP-2 | Bluetooth 3.0 | 58mm/80mm | UTF-8 |
| InnerPrinter | Bluetooth 2.1 | 58mm | ASCII |
| BlueBamboo P25 | Bluetooth 4.0 | 58mm | UTF-8 |

### Getting Help
1. Check this document first
2. Review [PRINTER_SETUP.md](PRINTER_SETUP.md) for alternative methods
3. Check browser console for errors (Chrome DevTools)
4. Enable verbose logging in [BluetoothService.ts](src/utils/BluetoothService.ts)
 (Immediate Print Setup)
```
1. Enable Bluetooth + Location on phone
2. Open Seematti Billing app
3. Settings → Pair Device → Select Printer
4. Settings → Default Printer Type → "Thermal"
5. Go to Billing → Add items → Save Bill
6. ✨ Bill prints IMMEDIATELY (auto-print)
7. App returns to billing in 5 seconds
8. Ready for next customer!
```

**Speed Optimization:**
- Pair printer once ✓
- Set default printer type ✓
- Bills print in <2 seconds after save ✓
- No manual dialog clicks needed ✓ ] Star Micronics SDK integration
- [ ] Epson SDK integration
- [ ] Tamil language support (image printing)
- [ ] QR code printing for UPI payments
- [ ] Logo printing on thermal receipts
- [ ] Custom receipt templates
- [ ] Print preview before sending to printer

### Feature Requests
Open an issue in the repository with:
- Printer model
- Desired feature
- Use case description

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Current | Initial Bluetooth implementation with ESC/POS support |

---

## 📄 License & Credits

**Developed by:** Seematti Billing Team  
**Bluetooth Plugin:** cordova-plugin-bluetooth-serial by Don Coleman  
**ESC/POS Reference:** EPSON Standard Commands

---

## 🎯 Quick Reference Card

### For End Users
```
1. Enable Bluetooth + Location
2. Open Seematti Billing
3. Settings → Pair Device
4. Select Printer
5. Save Bill → Auto-prints
```

### For Developers
```typescript
// Get connection status
const isConnected = await BluetoothService.isConnected();

// Manual print
await PrinterService.printReceipt({
    shopName: "My Shop",
    billNo: "001",
    date: new Date().toLocaleDateString(),
    items: [...],
    total: 1000,
    grandTotal: 1000
});

// Disconnect
await BluetoothService.disconnect();
```

---

**Last Updated:** January 22, 2026  
**Document Version:** 1.0
