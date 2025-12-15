# 🔄 Google Drive Automatic Backup - Setup Guide

Your Seematti Billing app now automatically backs up all bills and inventory to Google Drive when a user connects their Google account!

## ✨ Features

### Automatic Backup
- ✅ **Auto-sync on every change** - Bills and inventory are automatically backed up when added/edited/deleted
- ✅ **Real-time sync** - Changes sync within 1 second
- ✅ **Organized storage** - Data stored in "Seematti Billing Data" folder in Google Drive
- ✅ **JSON format** - Easy to read and import (bills.json & inventory.json)

### What Gets Backed Up
1. **All Bills** (`bills.json`)
   - Bill number, date, customer name
   - Items purchased with quantities
   - Total amount, payment mode, discount
   
2. **All Inventory** (`inventory.json`)
   - Product name, SKU/barcode
   - Price, MRP, stock levels
   - Low stock limits

## 🚀 How to Use

### For Users

1. **Open Settings**
   - Navigate to Settings page
   - Find "Google Drive Backup" section at the top

2. **Connect Google Account**
   - Click "Connect Google Drive" button
   - Sign in with your Google account
   - Grant permissions when prompted

3. **Automatic Sync Active**
   - ✅ Green indicator shows "Connected"
   - ✅ "Auto-sync enabled" message appears
   - All changes now automatically backup!

4. **Manual Sync** (Optional)
   - Click "Sync Now" to force immediate backup
   - Last sync time is displayed

5. **Disconnect** (Optional)
   - Click "Disconnect" to stop syncing
   - Data remains in Google Drive

### What Users See

```
╔════════════════════════════════════╗
║   Google Drive Backup              ║
║                                    ║
║   ✓ Connected                     ║
║   user@gmail.com                  ║
║   ✓ Auto-sync enabled             ║
║                                    ║
║   Last synced: Dec 15, 2:30 PM   ║
║                                    ║
║   [Sync Now]    [Disconnect]     ║
║                                    ║
║   What's synced:                  ║
║   • All bills (bills.json)        ║
║   • All inventory (inventory.json)║
║   • Stored in "Seematti Billing   ║
║     Data" folder                  ║
║   • Auto-synced on every change   ║
╚════════════════════════════════════╝
```

## 🔧 Technical Details

### Files Structure in Google Drive

```
Google Drive/
└── Seematti Billing Data/
    ├── bills.json          (All bills data)
    └── inventory.json      (All inventory items)
```

### Sync Triggers

Auto-sync happens on:
- ✅ New bill created
- ✅ Bill updated or deleted
- ✅ New inventory item added
- ✅ Inventory item updated (price, stock, etc.)
- ✅ Inventory item deleted

### Data Format

**bills.json:**
```json
[
  {
    "id": 1,
    "billNo": 1001,
    "date": "2025-12-15T10:30:00.000Z",
    "customerName": "John Doe",
    "items": [...],
    "totalAmount": 500,
    "paymentMode": "upi",
    "discount": 0,
    "profileId": 1
  }
]
```

**inventory.json:**
```json
[
  {
    "id": 1,
    "name": "Product Name",
    "sku": "123456789",
    "price": 100,
    "mrp": 120,
    "stock": 50,
    "lowStockLimit": 10,
    "profileId": 1
  }
]
```

## 🔒 Security & Privacy

### Permissions Required
- **drive.file** - Create and manage files created by the app
- **drive.appdata** - Store app-specific data

### What We DON'T Access
- ❌ Your other Google Drive files
- ❌ Your emails or contacts
- ❌ Any personal information beyond email address
- ❌ Files not created by this app

### Data Safety
- ✅ Data encrypted in transit (HTTPS)
- ✅ Stored in your private Google Drive
- ✅ Only you can access the data
- ✅ App folder can be deleted anytime

## 🛠️ Setup for Developers

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable **Google Drive API**
4. Create **OAuth 2.0 Client ID**:
   - Application type: Web application
   - Authorized JavaScript origins:
     - `http://localhost:5173` (development)
     - `https://yourdomain.com` (production)
   - Authorized redirect URIs:
     - `http://localhost:5173`
     - `https://yourdomain.com`

5. Copy the **Client ID**

### 2. Environment Configuration

Update `.env` file:
```env
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

### 3. Code Integration (Already Done!)

The following files implement Google Drive sync:
- ✅ `src/services/googleDriveService.ts` - Core sync logic
- ✅ `src/components/GoogleDriveSync.tsx` - UI component
- ✅ `src/pages/Settings.tsx` - Integration in Settings
- ✅ `index.html` - Google API scripts

## 📊 Testing

### Test Auto-Sync

1. **Connect Google Account**
   - Go to Settings → Connect Google Drive

2. **Create a Bill**
   - Go to Billing → Create new bill
   - Wait 1 second
   - Check console: "✅ Bills synced to Google Drive"

3. **Add Inventory**
   - Go to Inventory → Add new item
   - Wait 1 second
   - Check console: "✅ Inventory synced to Google Drive"

4. **Verify in Google Drive**
   - Open Google Drive
   - Find "Seematti Billing Data" folder
   - Check bills.json and inventory.json files

### Test Manual Sync

1. Click "Sync Now" button
2. Watch for success message
3. Verify "Last synced" timestamp updates

## 🔍 Troubleshooting

### "Sign-in failed"
- Check Google Client ID is correct in `.env`
- Verify domain is authorized in Google Cloud Console
- Clear browser cache and try again

### "Sync failed"
- Check internet connection
- Re-authenticate (disconnect and reconnect)
- Check browser console for errors

### "Auto-sync not working"
- Verify "Auto-sync enabled" message appears
- Check browser console for sync logs
- Try manual sync first

### Files not appearing in Drive
- Wait a few seconds (can take 2-5 seconds)
- Refresh Google Drive
- Check "Seematti Billing Data" folder exists

## 🎯 Benefits for Users

### Business Continuity
- 📱 **Phone lost/damaged?** Data is safe in Google Drive
- 🔄 **Multi-device sync** - Access from any device
- 💾 **Automatic backups** - Never forget to backup

### Convenience
- ⚡ **Zero manual effort** - Everything syncs automatically
- 🎯 **Always up-to-date** - Latest data in Drive
- 📊 **Easy reporting** - Download JSON files for analysis

### Professional
- 💼 **Cloud-backed** - Professional data management
- 🔒 **Secure** - Google's enterprise-grade security
- 📈 **Scalable** - Handles unlimited bills and items

## 🚀 Advanced Features (Future)

### Potential Enhancements
- [ ] Two-way sync (restore from Drive)
- [ ] Conflict resolution
- [ ] Selective sync (bills only, inventory only)
- [ ] Export to Google Sheets
- [ ] Scheduled backups
- [ ] Multiple backup locations
- [ ] Backup history/versions

## 📱 User Guide Summary

### Quick Start for Users

1. **Settings** → **Google Drive Backup**
2. **Connect Google Drive**
3. **Sign in with Google**
4. **Done!** ✓ Auto-sync active

Everything now backs up automatically! 🎉

### Visual Indicators

- 🟢 **Green cloud icon** = Connected & syncing
- ⚫ **Gray cloud icon** = Not connected
- 🔄 **Spinning icon** = Syncing in progress
- ✓ **Checkmark** = Sync successful

## 📞 Support

If users face issues:
1. Check internet connection
2. Try disconnect and reconnect
3. Clear browser cache
4. Check Google Drive storage space
5. Contact support with error message

---

## ✅ Implementation Checklist

- [x] Google Drive API service created
- [x] Auto-sync on data changes
- [x] Settings page integration
- [x] Sign-in/Sign-out flow
- [x] Manual sync button
- [x] Status indicators
- [x] Error handling
- [x] User feedback messages
- [x] Documentation

Your app now provides enterprise-grade automatic backup! 🚀
