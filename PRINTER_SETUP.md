# Printer Setup & Debugging Guide for Seematti Billing (Mobile)

This guide covers how to set up and troubleshoot Thermal Printers (58mm/80mm) on Android devices using the Seematti Billing App.

## 1. Connection Methods

The app supports two main ways to print on mobile:

### A. USB / System Print (Recommended for Stability)
Uses the Android system print service. This is the most reliable method but requires a helper app to "teach" Android how to talk to your specific thermal printer.

**How it works:**  
The app generates a printable receipt -> Opens Android default Print Dialog -> You select your printer -> Prints.

### B. Bluetooth Direct (Experimental)
The app tries to talk directly to the printer using Web Bluetooth.
*Note: This works best in Chrome browser and requires specific browser flags to be enabled in some versions.*

---

## 2. Setting Up USB / System Print (Best Method)

To use your thermal printer via USB or standard Bluetooth pair (acting as a system printer), you need a **Print Service Plugin**.

**We highly recommend usage of "RawBT" or "Nokoprint" app from Play Store.**

### Step-by-Step Setup:

1.  **Install RawBT:**
    *   Go to Google Play Store.
    *   Search for **"RawBT Print Service"**.
    *   Install it.

2.  **Configure RawBT:**
    *   Open RawBT app.
    *   **For USB:** Connect your printer via OTG cable. Tap "Connection method" -> "USB" -> Select your printer.
    *   **For Bluetooth:** Pair your printer in Android Settings first. Then in RawBT, tap "Connection method" -> "Bluetooth" -> Select your printer.
    *   Tap the **"Test"** button in RawBT to ensure it prints.

3.  **Enable the Service:**
    *   Go to Android **Settings** -> **Connected Devices** -> **Connection Preferences** -> **Printing**.
    *   Find **RawBT** (or the service you installed).
    *   Turn it **ON**.

4.  **Configure Seematti App:**
    *   Open Seematti Billing App.
    *   Go to **Settings**.
    *   Under **Default Printer Type**, select **Thermal**.
    *   Under **Printer Connection Interface**, select **USB / System**.

5.  **Printing:**
    *   When you print a bill, the Android System Print dialog will open.
    *   Select your printer from the dropdown (choose "RawBT" if your printer name doesn't appear directly).
    *   Tap print.

---

## 3. Setting Up Bluetooth Direct (In-App)

This method lets the website/app control the bluetooth directly.

### Requirements:
*   Android Device with Bluetooth ON.
*   **Location Services (GPS) MUST be ON** (Android requirement for Bluetooth scanning).
*   Chrome Browser (Updated).
*   **HTTPS:** The app must be served over HTTPS (if using web) or be installed as PWA.

### Step-by-Step Setup:

1.  **Grant Permissions (If App installed via APK):**
    *   Long press the App icon -> App Info.
    *   Permissions -> Allow **Local Network**, **Main**, **Location**, and **Bluetooth** (if listed).

2.  **Configure Seematti App:**
    *   Go to **Settings**.
    *   Under **Default Printer Type**, select **Thermal**.
    *   Under **Printer Connection Interface**, select **Bluetooth**.
    *   Click **"Pair Device"**.
    *   A browser popup will appear scanning for devices. Select your printer (often named "RPP02N", "MTP-2", "InnerPrinter" etc).
    *   **Note:** If "Pair Device" does nothing, ensure you are not blocking popups/permissions.

---

## 4. Debugging & Troubleshooting

### Issue: "Printer not found" (Bluetooth)
*   **Solution 1:** Turn Bluetooth OFF and ON again on mobile.
*   **Solution 2:** Restart the Printer.
*   **Solution 3:** **Turn on Location/GPS.** Android will NOT show bluetooth devices if Location is off.
*   **Solution 4:** Unpair the device from Android Bluetooth Settings and try pairing *only* through the app (or vice versa).

### Issue: "Print Preview Closes Too Fast"
*   The app is set to close preview after 5 seconds for speed.
*   If using **System Print (Method A)**, sometimes the system dialog is slow.
*   **Fix:** If you need more time, let us know to increase the timeout in the code.

### Issue: "Garbage characters printing" (e.g., %&^%#)
*   This means the baud rate is wrong or the printer doesn't support the image/text mode being sent.
*   **Fix:** Switch to **Method A (System Print)** using RawBT. RawBT handles the driver translation perfectly for almost all cheap thermal printers.

### Issue: "Bluetooth Pairing Failed" inside App
*   Web Bluetooth is picky.
*   Use **Method A (System Print)** instead. It is much more stable because it uses the OS level driver.

---

## Summary Recommendation
For the most stable mobile experience:
1.  Install **RawBT** app.
2.  Configure your printer inside RawBT.
3.  In Seematti Billing Settings, choose **Interface: USB / System**.
4.  This works for both USB (OTG) and Bluetooth printers and is 100% reliable.
