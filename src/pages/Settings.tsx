import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { db, Profile } from '@/db/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Globe, Database, Printer, ArrowUp, ArrowDown, Bluetooth, Usb, Save, Loader2, RefreshCcw, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { compressImage } from '@/lib/imageUtils';
import { getBackupConfig, saveBackupConfig, AutoBackupConfig, performBackup, getLastBackupTime, checkAndPerformBackup } from '@/utils/backupManager';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { BluetoothService, BluetoothDevice } from '@/utils/BluetoothService';


const Settings = () => {
    const { t, i18n } = useTranslation();
    const profiles = useLiveQuery(() => db.profiles.toArray());
    const [isEditing, setIsEditing] = useState(false);
    const [newProfile, setNewProfile] = useState<Partial<Profile>>({});
    const [connectionType, setConnectionType] = useState(localStorage.getItem('printerConnectionType') || 'usb');
    const [printerPaperSize, setPrinterPaperSize] = useState(localStorage.getItem('printerPaperSize') || '58mm');
    const [btDeviceName, setBtDeviceName] = useState(localStorage.getItem('bluetoothDeviceName') || '');
    const [backupConfig, setBackupConfig] = useState<AutoBackupConfig>(getBackupConfig());
    const [lastBackup] = useState<string | null>(getLastBackupTime());
    const [showBackupModal, setShowBackupModal] = useState(false);
    const [backupProfileId, setBackupProfileId] = useState<string>('all');
    const [isPwaFolderSet, setIsPwaFolderSet] = useState(false);

    // Bluetooth State
    const [showBtModal, setShowBtModal] = useState(false);
    const [btDevices, setBtDevices] = useState<BluetoothDevice[]>([]);
    const [isScanningBt, setIsScanningBt] = useState(false);
    const [showTemplatePreview, setShowTemplatePreview] = useState(false);
    
    // Sales Report State
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportType, setReportType] = useState<string>('');
    const [isPrinting, setIsPrinting] = useState(false);
    const [reportDateType, setReportDateType] = useState<'month' | 'dateRange'>('month');
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM format
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD format
    const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [reportProfileId, setReportProfileId] = useState<number | 'all'>('all');

    // Collapse State for sections
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
        printer: false,
        language: false,
        data: false,
        reports: false
    });

    const toggleSection = (section: string) => {
        setCollapsedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    useEffect(() => {
        db.appConfig.get('backupFolderHandle').then(h => {
            // ... existing code ...
            // In browser, handle might need verification but presence is good enough indicator
            setIsPwaFolderSet(!!h);
        });
    }, []);

    const selectFolder = async () => {
        // Check if running on mobile platform
        const platform = Capacitor.getPlatform();
        if (platform === 'android' || platform === 'ios') {
            alert('📱 On mobile, backups are automatically saved to:\nDocuments/Seematti_Backups/\n\nYou can access them using your device\'s file manager.');
            return;
        }

        try {
            const handle = await (window as any).showDirectoryPicker();
            if (handle) {
                await db.appConfig.put({ key: 'backupFolderHandle', value: handle });
                setIsPwaFolderSet(true);
                alert("Folder Linked Successfully! Auto Backups will now save here.");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const toggleLanguage = () => {
        const newLang = i18n.language === 'en' ? 'ta' : 'en';
        i18n.changeLanguage(newLang);
        localStorage.setItem('language', newLang);
    };

    const handleSaveProfile = async () => {
        if (!newProfile.businessName) return;

        const profileData = {
            businessName: newProfile.businessName || '',
            address: newProfile.address || '',
            phone: newProfile.phone || '',
            upiId: newProfile.upiId || '',
            logo: newProfile.logo || '',
            enableUnits: newProfile.enableUnits || false,
            units: newProfile.units || ['pieces', 'kg', 'grams', 'liters'],
            enableMRP: newProfile.enableMRP || false,
            autoPriceEntry: newProfile.autoPriceEntry || false,
            defaultDiscountType: newProfile.defaultDiscountType || 'amount',
            defaultDiscountValue: newProfile.defaultDiscountValue || 0
        } as Profile;

        if (newProfile.id) {
            await db.profiles.update(newProfile.id, profileData);
        } else {
            await db.profiles.add(profileData);
        }

        setIsEditing(false);
        setNewProfile({});
    };

    const handleDeleteProfile = (id?: number) => {
        if (id) db.profiles.delete(id);
    };

    const performExport = async () => {
        try {
            const allItems = await db.items.toArray();
            const allBills = await db.bills.toArray();
            const allProfiles = await db.profiles.toArray();
            const allCategories = await db.categories.toArray();
            const allParties = await db.parties.toArray();
            const allTrans = await db.partyTransactions.toArray();

            let backupData: any = {};

            if (backupProfileId === 'all') {
                backupData = {
                    profiles: allProfiles,
                    items: allItems,
                    bills: allBills,
                    categories: allCategories,
                    parties: allParties,
                    transactions: allTrans
                };
            } else {
                const pid = Number(backupProfileId);
                const profile = allProfiles.find(p => p.id === pid);
                backupData = {
                    profiles: profile ? [profile] : [],
                    items: allItems.filter(i => i.profileId === pid),
                    bills: allBills.filter(b => b.profileId === pid),
                    categories: allCategories.filter(c => c.profileId === pid),
                    parties: allParties.filter(p => p.profileId === pid),
                    transactions: allTrans.filter(t => t.profileId === pid)
                };
            }

            // Create complete backup structure with version info
            const exportData = {
                version: '1.0',
                appName: 'Seematti Billing',
                exportDate: new Date().toISOString(),
                exportType: backupProfileId === 'all' ? 'complete' : 'profile',
                deviceInfo: {
                    platform: Capacitor.getPlatform(),
                    userAgent: navigator.userAgent
                },
                data: backupData,
                metadata: {
                    totalProfiles: backupData.profiles?.length || 0,
                    totalItems: backupData.items?.length || 0,
                    totalBills: backupData.bills?.length || 0,
                    totalCategories: backupData.categories?.length || 0,
                    totalParties: backupData.parties?.length || 0,
                    totalTransactions: backupData.transactions?.length || 0
                }
            };

            const jsonContent = JSON.stringify(exportData, null, 2);
            const prefix = backupProfileId === 'all' ? 'BillPodu_Full' : `BillPodu_${allProfiles.find(p => p.id === Number(backupProfileId))?.businessName.replace(/[^a-z0-9]/gi, '_') || 'Profile'}`;
            const fileName = `${prefix}_Backup_${new Date().toISOString().split('T')[0]}.json`;

            // Check if running on mobile (Capacitor)
            if (Capacitor.isNativePlatform()) {
                // Mobile: Save to Downloads folder using Filesystem API
                const result = await Filesystem.writeFile({
                    path: fileName,
                    data: jsonContent,
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8
                });

                alert(
                    `✅ Backup saved successfully!\n\n` +
                    `Location: Documents/${fileName}\n\n` +
                    `Backup contains:\n` +
                    `- ${exportData.metadata.totalProfiles} profile(s)\n` +
                    `- ${exportData.metadata.totalItems} item(s)\n` +
                    `- ${exportData.metadata.totalBills} bill(s)\n` +
                    `- ${exportData.metadata.totalCategories} category(ies)\n` +
                    `- ${exportData.metadata.totalParties} party(ies)\n` +
                    `- ${exportData.metadata.totalTransactions} transaction(s)\n\n` +
                    `You can find it in your file manager.`
                );
                console.log('File saved to:', result.uri);
            } else {
                // Browser: Use download link
                const blob = new Blob([jsonContent], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
                
                alert(
                    `✅ Backup downloaded successfully!\n\n` +
                    `Exported:\n` +
                    `- ${exportData.metadata.totalProfiles} profile(s)\n` +
                    `- ${exportData.metadata.totalItems} item(s)\n` +
                    `- ${exportData.metadata.totalBills} bill(s)\n` +
                    `- ${exportData.metadata.totalCategories} category(ies)\n` +
                    `- ${exportData.metadata.totalParties} party(ies)\n` +
                    `- ${exportData.metadata.totalTransactions} transaction(s)`
                );
            }

            setShowBackupModal(false);
        } catch (error) {
            console.error('Export error:', error);
            alert(`❌ Export failed: ${error}`);
        }
    };

    const handleRestore = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const jsonData = JSON.parse(event.target?.result as string);
                    
                    // Check if it's a versioned complete backup
                    const isCompleteBackup = jsonData.version && jsonData.data && jsonData.metadata;
                    
                    if (isCompleteBackup) {
                        // Show backup details and get confirmation
                        const confirmRestore = confirm(
                            `Complete Backup Restore\n\n` +
                            `Backup Date: ${new Date(jsonData.exportDate).toLocaleString()}\n` +
                            `Type: ${jsonData.exportType || 'complete'}\n\n` +
                            `This backup contains:\n` +
                            `- ${jsonData.metadata.totalProfiles} profile(s)\n` +
                            `- ${jsonData.metadata.totalItems} item(s)\n` +
                            `- ${jsonData.metadata.totalBills} bill(s)\n` +
                            `- ${jsonData.metadata.totalCategories} category(ies)\n` +
                            `- ${jsonData.metadata.totalParties} party(ies)\n` +
                            `- ${jsonData.metadata.totalTransactions} transaction(s)\n\n` +
                            `⚠️ WARNING: This will REPLACE all your current data!\n\n` +
                            `Do you want to continue?`
                        );

                        if (!confirmRestore) {
                            alert('Restore cancelled. Your data is safe.');
                            return;
                        }

                        // Second confirmation for safety
                        const finalConfirm = confirm(
                            `FINAL CONFIRMATION\n\n` +
                            `This action cannot be undone.\n` +
                            `All your current data will be permanently replaced.\n\n` +
                            `Are you absolutely sure?`
                        );

                        if (!finalConfirm) {
                            alert('Restore cancelled. Your data is safe.');
                            return;
                        }

                        // Perform complete restore
                        const data = jsonData.data;
                        await db.transaction('rw', [db.profiles, db.items, db.bills, db.categories, db.parties, db.partyTransactions], async () => {
                            // Clear all existing data
                            await db.profiles.clear();
                            await db.items.clear();
                            await db.bills.clear();
                            await db.categories.clear();
                            await db.parties.clear();
                            await db.partyTransactions.clear();

                            // Restore all data
                            if (data.profiles?.length) await db.profiles.bulkAdd(data.profiles);
                            if (data.items?.length) await db.items.bulkAdd(data.items);
                            if (data.bills?.length) await db.bills.bulkAdd(data.bills);
                            if (data.categories?.length) await db.categories.bulkAdd(data.categories);
                            if (data.parties?.length) await db.parties.bulkAdd(data.parties);
                            if (data.transactions?.length) await db.partyTransactions.bulkAdd(data.transactions);
                        });

                        alert(
                            `✅ Backup restored successfully!\n\n` +
                            `Restored:\n` +
                            `- ${data.profiles?.length || 0} profile(s)\n` +
                            `- ${data.items?.length || 0} item(s)\n` +
                            `- ${data.bills?.length || 0} bill(s)\n` +
                            `- ${data.categories?.length || 0} category(ies)\n` +
                            `- ${data.parties?.length || 0} party(ies)\n` +
                            `- ${data.transactions?.length || 0} transaction(s)\n\n` +
                            `The app will now reload to refresh all data.`
                        );
                        
                        // Reload the app
                        window.location.reload();
                    } else {
                        // Old format backup (backward compatibility)
                        const confirmRestore = confirm(
                            `This appears to be an older backup format.\n\n` +
                            `⚠️ WARNING: This will REPLACE all your current data!\n\n` +
                            `Do you want to continue?`
                        );

                        if (!confirmRestore) {
                            alert('Restore cancelled.');
                            return;
                        }

                        await db.transaction('rw', [db.profiles, db.items, db.bills, db.categories, db.parties, db.partyTransactions], async () => {
                            await db.items.clear();
                            await db.bills.clear();
                            await db.profiles.clear();
                            await db.categories.clear();
                            await db.parties.clear();
                            await db.partyTransactions.clear();

                            if (jsonData.items?.length) await db.items.bulkAdd(jsonData.items);
                            if (jsonData.bills?.length) await db.bills.bulkAdd(jsonData.bills);
                            if (jsonData.profiles?.length) await db.profiles.bulkAdd(jsonData.profiles);
                            if (jsonData.categories?.length) await db.categories.bulkAdd(jsonData.categories);
                            if (jsonData.parties?.length) await db.parties.bulkAdd(jsonData.parties);
                            if (jsonData.transactions?.length) await db.partyTransactions.bulkAdd(jsonData.transactions);
                        });

                        alert('✅ Restore Successful!\n\nThe app will now reload.');
                        window.location.reload();
                    }
                } catch (err) {
                    console.error('Restore error:', err);
                    alert(`❌ Restore Failed\n\nError: ${err instanceof Error ? err.message : 'Invalid backup file format'}`);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const printReport = async (reportContent: string) => {
        const { EscPos } = await import('@/utils/EscPos');
        const encoder = new EscPos();
        
        const paperWidth = localStorage.getItem('printerPaperSize') || '58mm';
        const maxChars = paperWidth === '80mm' ? 48 : 32;
        
        // Get font settings
        const headerFontSize = localStorage.getItem('headerFontSize') || 'normal';
        const itemsFontSize = localStorage.getItem('itemsFontSize') || 'normal';
        const footerFontSize = localStorage.getItem('footerFontSize') || 'normal';
        const boldHeader = localStorage.getItem('boldHeader') !== 'false';
        const boldItems = localStorage.getItem('boldItems') === 'true';
        const boldFooter = localStorage.getItem('boldFooter') === 'true';
        
        encoder.align('CENTER');
        if (boldHeader) encoder.bold(true);
        if (headerFontSize === 'large') encoder.size('LARGE');
        encoder.textLine('BILL PODU');
        encoder.size('NORMAL');
        if (boldHeader) encoder.bold(false);
        encoder.feed(1);
        
        // Print report content
        const lines = reportContent.split('\n');
        lines.forEach(line => {
            if (line.startsWith('===')) {
                encoder.textLine('='.repeat(maxChars));
            } else if (line.startsWith('---')) {
                encoder.textLine('-'.repeat(maxChars));
            } else if (line.startsWith('**')) {
                if (boldItems) encoder.bold(true);
                if (itemsFontSize === 'large') encoder.size('LARGE');
                encoder.textLine(line.replace(/\*\*/g, ''));
                encoder.size('NORMAL');
                if (boldItems) encoder.bold(false);
            } else if (line.startsWith('##')) {
                encoder.align('CENTER');
                if (boldHeader) encoder.bold(true);
                if (headerFontSize === 'large') encoder.size('LARGE');
                encoder.textLine(line.replace('##', '').trim());
                encoder.size('NORMAL');
                if (boldHeader) encoder.bold(false);
                encoder.align('LEFT');
            } else {
                if (itemsFontSize === 'large') encoder.size('LARGE');
                encoder.textLine(line);
                encoder.size('NORMAL');
            }
        });
        
        if (boldFooter) encoder.bold(true);
        if (footerFontSize === 'large') encoder.size('LARGE');
        encoder.feed(3);
        encoder.size('NORMAL');
        if (boldFooter) encoder.bold(false);
        encoder.cut();
        
        const bytes = encoder.getBytes();
        await BluetoothService.write(bytes);
    };

    const openBluetoothModal = async () => {
        // Debug check removed


        setShowBtModal(true);
        setBtDevices([]);
        try {
            await BluetoothService.requestPermissions();
            const isEnabled = await BluetoothService.isEnabled();
            if (!isEnabled) {
                await BluetoothService.enable();
            }
            const paired = await BluetoothService.list();
            setBtDevices(paired);
        } catch (e) {
            console.error(e);
            // In browser dev mode, this will fail elegantly
            if (!(window as any).bluetoothSerial) {
                // Already alerted details above
            } else {
                alert("Could not access Bluetooth. Ensure permissions are granted.");
            }
        }
    };

    const scanUnpaired = async () => {
        setIsScanningBt(true);
        try {
            const unpaired = await BluetoothService.discoverUnpaired();
            setBtDevices(prev => {
                const unique = new Map(prev.map(d => [d.address, d]));
                unpaired.forEach(d => unique.set(d.address, d));
                return Array.from(unique.values());
            });
        } catch (e: any) {
            const errStr = typeof e === 'string' ? e : JSON.stringify(e);
            console.error(errStr);
            if (errStr.includes("BLUETOOTH_SCAN") || errStr.includes("permission")) {
                alert("Permission Missing: Please go to Phone Settings -> Apps -> Bill Podu -> Permissions. \n\nAllow 'Nearby Devices' and 'Location'.");
            } else if (errStr.includes("Location")) {
                alert("Scan Failed: Please turn on GPS / Location Services.");
            } else {
                alert("Scan failed: " + errStr);
            }
        } finally {
            setIsScanningBt(false);
        }
    };

    const connectToDevice = async (device: BluetoothDevice) => {
        try {
            await BluetoothService.connect(device.address);

            // Save printer for auto-reconnection (Vyapar-style)
            BluetoothService.savePrinter(device.address, device.name);

            setBtDeviceName(device.name);
            localStorage.setItem('printerConnectionType', 'bluetooth');
            setConnectionType('bluetooth');
            setShowBtModal(false);
            alert(`✅ Connected to ${device.name}\n\nPrinter will auto-connect on next app launch.`);
        } catch (e) {
            console.error(e);
            alert("Connection Failed. \n\nEnsure device is ON and supports Bluetooth Serial (SPP). \n\nNote: Laptops/Phones usually don't support this mode unless running special software.");
        }
    };

    return (
        <div className="p-4 space-y-6 w-full lg:max-w-7xl xl:max-w-full mx-auto pb-24 lg:px-6 xl:px-8">
            <h1 className="text-2xl font-bold">{t('settings')}</h1>



            {/* Language Section */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        {t('language')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <span>{i18n.language === 'en' ? 'English' : 'தமிழ்'}</span>
                        <Button variant="outline" size="sm" onClick={toggleLanguage}>
                            Switch to {i18n.language === 'en' ? 'Tamil' : 'English'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Profiles Section */}
            <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">{t('profile')}</CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => {
                        setNewProfile({});
                        setIsEditing(!isEditing);
                    }}>
                        <Plus className="w-5 h-5" />
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {profiles?.map((profile) => (
                        <div key={profile.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                            <div className="flex items-center gap-3">
                                {profile.logo && (
                                    <img src={profile.logo} alt="Logo" className="w-10 h-10 object-contain rounded bg-white border" />
                                )}
                                <div>
                                    <p className="font-semibold">{profile.businessName}</p>
                                    <p className="text-sm text-gray-500">{profile.phone}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon" onClick={() => {
                                    setNewProfile(profile);
                                    setIsEditing(true);
                                }}>
                                    <Printer className="w-4 h-4 text-slate-500" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteProfile(profile.id)}>
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                            </div>
                        </div>
                    ))}

                    {isEditing && (
                        <div className="space-y-3 p-4 border rounded-lg bg-slate-50 mt-4 animate-in fade-in slide-in-from-top-2">
                            <h3 className="font-medium text-sm">{newProfile.id ? 'Edit Profile' : 'New Profile'}</h3>

                            {/* Logo Upload */}
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 bg-white border rounded flex items-center justify-center overflow-hidden relative">
                                    {newProfile.logo ? (
                                        <img src={newProfile.logo} alt="Preview" className="h-full w-full object-contain" />
                                    ) : (
                                        <span className="text-xs text-gray-400">No Logo</span>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-medium block mb-1">Business Logo</label>
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                try {
                                                    const base64 = await compressImage(file);
                                                    setNewProfile({ ...newProfile, logo: base64 });
                                                } catch (err) {
                                                    alert('Error processing image');
                                                }
                                            }
                                        }}
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">Max size optimized for thermal printing</p>
                                </div>
                            </div>

                            <Input
                                placeholder="Business Name"
                                value={newProfile.businessName || ''}
                                onChange={(e) => setNewProfile({ ...newProfile, businessName: e.target.value })}
                            />
                            <Input
                                placeholder="Address"
                                value={newProfile.address || ''}
                                onChange={(e) => setNewProfile({ ...newProfile, address: e.target.value })}
                            />
                            <Input
                                placeholder="Phone"
                                value={newProfile.phone || ''}
                                onChange={(e) => setNewProfile({ ...newProfile, phone: e.target.value })}
                            />
                            <Input
                                placeholder="UPI ID (e.g. name@okhdfcbank)"
                                value={newProfile.upiId || ''}
                                onChange={(e) => setNewProfile({ ...newProfile, upiId: e.target.value })}
                            />

                            {/* MRP Configuration */}
                            <div className="space-y-3 p-3 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="enableMRP"
                                        className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
                                        checked={newProfile.enableMRP || false}
                                        onChange={e => setNewProfile({ 
                                            ...newProfile, 
                                            enableMRP: e.target.checked
                                        })}
                                    />
                                    <label htmlFor="enableMRP" className="text-sm font-medium cursor-pointer">
                                        Enable MRP Input in Billing
                                    </label>
                                </div>
                            </div>

                            {/* Auto Price Entry Configuration */}
                            <div className="space-y-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="autoPriceEntry"
                                        className="w-4 h-4 text-yellow-600 bg-gray-100 border-gray-300 rounded focus:ring-yellow-500"
                                        checked={newProfile.autoPriceEntry || false}
                                        onChange={e => setNewProfile({ 
                                            ...newProfile, 
                                            autoPriceEntry: e.target.checked
                                        })}
                                    />
                                    <label htmlFor="autoPriceEntry" className="text-sm font-medium cursor-pointer">
                                        Auto-focus Price Input (opens keypad when item added)
                                    </label>
                                </div>
                            </div>

                            {/* Units Configuration */}
                            <div className="space-y-3 p-3 bg-slate-50 rounded-lg border">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="enableUnits"
                                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                        checked={newProfile.enableUnits || false}
                                        onChange={e => setNewProfile({ 
                                            ...newProfile, 
                                            enableUnits: e.target.checked,
                                            units: e.target.checked ? (newProfile.units || ['pieces', 'kg', 'grams', 'liters']) : undefined
                                        })}
                                    />
                                    <label htmlFor="enableUnits" className="text-sm font-medium cursor-pointer">
                                        Enable Units (kg, pieces, etc.)
                                    </label>
                                </div>

                                {newProfile.enableUnits && (
                                    <div>
                                        <label className="text-xs font-medium block mb-1">Available Units</label>
                                        <Input
                                            placeholder="e.g., pieces, kg, grams, liters, boxes"
                                            value={(newProfile.units || []).join(', ')}
                                            onChange={(e) => {
                                                const unitsArray = e.target.value.split(',').map(u => u.trim()).filter(u => u);
                                                setNewProfile({ ...newProfile, units: unitsArray });
                                            }}
                                        />
                                        <p className="text-[10px] text-gray-500 mt-1">Separate units with commas</p>
                                    </div>
                                )}
                            </div>

                            {/* Default Discount Configuration */}
                            <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <label className="text-sm font-medium text-blue-900 block">Default Discount Settings</label>
                                
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-600 mb-1 block">Discount Type</label>
                                        <select
                                            className="w-full p-2 border rounded-md text-sm bg-white"
                                            value={newProfile.defaultDiscountType || 'amount'}
                                            onChange={(e) => setNewProfile({ 
                                                ...newProfile, 
                                                defaultDiscountType: e.target.value as 'amount' | 'percentage'
                                            })}
                                        >
                                            <option value="amount">Rupees (₹)</option>
                                            <option value="percentage">Percentage (%)</option>
                                        </select>
                                    </div>
                                    
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-600 mb-1 block">Default Value</label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            min="0"
                                            value={newProfile.defaultDiscountValue || 0}
                                            onChange={(e) => setNewProfile({ 
                                                ...newProfile, 
                                                defaultDiscountValue: Number(e.target.value)
                                            })}
                                        />
                                    </div>
                                </div>
                                <p className="text-[10px] text-blue-700">
                                    This discount will be automatically applied in the billing section
                                </p>
                            </div>

                            <div className="flex gap-2 justify-end mt-2">
                                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>{t('cancel')}</Button>
                                <Button size="sm" onClick={handleSaveProfile}>{t('save')}</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
                <div className="p-4 border-t bg-gray-50 rounded-b-lg">
                    <label className="text-xs font-medium uppercase text-slate-500 block mb-2">{t('default_business_profile')}</label>
                    <select
                        className="w-full p-2 border rounded-md text-sm"
                        value={localStorage.getItem('defaultProfileId') || ''}
                        onChange={(e) => {
                            localStorage.setItem('defaultProfileId', e.target.value);
                            alert('Default profile saved');
                        }}
                    >
                        <option value="">Select Default Profile</option>
                        {profiles?.map(p => (
                            <option key={p.id} value={p.id}>{p.businessName}</option>
                        ))}
                    </select>
                </div>
            </Card>

            {/* Printer & Template Section */}
            <Card>
                <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSection('printer')}>
                    <CardTitle className="text-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Printer className="w-5 h-5" />
                            {t('printer_template')}
                        </div>
                        {collapsedSections.printer ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                    </CardTitle>
                </CardHeader>
                {!collapsedSections.printer && (
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-medium uppercase text-slate-500">{t('default_printer_type')}</label>
                        <select
                            className="w-full p-2 border rounded-md text-sm"
                            onChange={(e) => {
                                localStorage.setItem('defaultPrinterType', e.target.value);
                                alert('Default printer saved');
                            }}
                            defaultValue={localStorage.getItem('defaultPrinterType') || 'thermal'}
                        >
                            <option value="ask">{t('always_ask')}</option>
                            <option value="thermal">{t('thermal')}</option>
                            <option value="a4">{t('a4_professional')}</option>
                        </select>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                        <label className="text-xs font-medium uppercase text-slate-500">{t('printer_interface')}</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div
                                className={`p-3 border rounded cursor-pointer flex flex-col items-center gap-2 ${connectionType === 'usb' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-slate-50'}`}
                                onClick={() => {
                                    setConnectionType('usb');
                                    localStorage.setItem('printerConnectionType', 'usb');
                                }}
                            >
                                <Usb className="w-6 h-6" />
                                <span className="text-xs font-bold">{t('usb_system')}</span>
                            </div>
                            <div
                                className={`p-3 border rounded cursor-pointer flex flex-col items-center gap-2 ${connectionType === 'bluetooth' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-slate-50'}`}
                                onClick={() => {
                                    setConnectionType('bluetooth');
                                    localStorage.setItem('printerConnectionType', 'bluetooth');
                                }}
                            >
                                <Bluetooth className="w-6 h-6" />
                                <span className="text-xs font-bold">{t('bluetooth')}</span>
                            </div>
                        </div>

                        {(localStorage.getItem('defaultPrinterType') === 'thermal' || !localStorage.getItem('defaultPrinterType')) && (
                            <div className="pt-2">
                                <label className="text-xs font-medium uppercase text-slate-500">Paper Size</label>
                                <div className="flex gap-4 mt-1 p-2 border rounded bg-slate-50">
                                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                                        <input
                                            type="radio"
                                            value="58mm"
                                            checked={printerPaperSize === '58mm'}
                                            onChange={() => {
                                                setPrinterPaperSize('58mm');
                                                localStorage.setItem('printerPaperSize', '58mm');
                                            }}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        2 Inch (58mm)
                                    </label>
                                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                                        <input
                                            type="radio"
                                            value="80mm"
                                            checked={printerPaperSize === '80mm'}
                                            onChange={() => {
                                                setPrinterPaperSize('80mm');
                                                localStorage.setItem('printerPaperSize', '80mm');
                                            }}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        3 Inch (80mm)
                                    </label>
                                </div>
                            </div>
                        )}

                        {connectionType === 'bluetooth' && (
                            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded text-sm space-y-2">
                                <p className="text-xs text-gray-600">
                                    Directly connect to a thermal printer.
                                </p>
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-xs">
                                        {btDeviceName ? `Paired: ${btDeviceName}` : 'No device paired'}
                                    </span>
                                    <Button size="sm" variant="outline" onClick={openBluetoothModal}>
                                        {btDeviceName ? 'Change Device' : 'Pair Device'}
                                    </Button>
                                </div>
                            </div>
                        )}
                        {connectionType === 'usb' && (
                            <div className="p-3 bg-slate-50 rounded text-xs text-gray-500">
                                Uses the system's default print dialog. Ensure your USB printer is installed in Windows/Android settings.
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium uppercase text-slate-500">{t('bill_template_options')}</label>
                        <div className="space-y-2">
                            {[
                                { id: 'showShopName', label: 'show_shop_name' },
                                { id: 'showAddress', label: 'show_address' },
                                { id: 'showPhone', label: 'show_phone' },
                                { id: 'showLogo', label: 'show_logo' },
                                { id: 'showFooter', label: 'show_footer' },
                                { id: 'showMrp', label: 'show_mrp_column' },
                                { id: 'showSavings', label: 'show_mrp_savings' },
                                { id: 'showQrCode', label: 'show_qr_code' },
                            ].map((opt) => (
                                <div key={opt.id} className="flex items-center justify-between p-2 border rounded bg-slate-50">
                                    <span className="text-sm">{t(opt.label)}</span>
                                    <input
                                        type="checkbox"
                                        defaultChecked={localStorage.getItem(opt.id) !== 'false'}
                                        onChange={(e) => localStorage.setItem(opt.id, String(e.target.checked))}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="pt-2 space-y-2">
                            <label className="text-xs font-medium uppercase text-slate-500">UPI ID for QR Code</label>
                            <Input
                                placeholder="e.g. yourname@upi"
                                defaultValue={localStorage.getItem('upiId') || ''}
                                onChange={(e) => localStorage.setItem('upiId', e.target.value)}
                            />
                            <p className="text-[10px] text-gray-500">Enter your UPI ID to generate payment QR codes with bill amount</p>
                        </div>

                        {/* Font Size Customization */}
                        <div className="pt-3 border-t space-y-3">
                            <label className="text-xs font-medium uppercase text-slate-500 flex items-center gap-2">
                                <span>🔤</span> Font Size & Style Customization
                            </label>
                            <p className="text-[10px] text-gray-500">Adjust font sizes and styles for different sections of the thermal bill</p>
                            
                            {/* Shop Name Font Size */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-600">Shop Name Size</label>
                                <select
                                    className="w-full p-2 border rounded-md text-sm bg-white"
                                    defaultValue={localStorage.getItem('shopNameFontSize') || 'normal'}
                                    onChange={(e) => localStorage.setItem('shopNameFontSize', e.target.value)}
                                >
                                    <option value="small">Small</option>
                                    <option value="normal">Normal</option>
                                    <option value="large">Large</option>
                                    <option value="xlarge">Extra Large</option>
                                </select>
                            </div>

                            {/* Header Font Size */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-600">Header (Address, Phone)</label>
                                <select
                                    className="w-full p-2 border rounded-md text-sm bg-white"
                                    defaultValue={localStorage.getItem('headerFontSize') || 'normal'}
                                    onChange={(e) => localStorage.setItem('headerFontSize', e.target.value)}
                                >
                                    <option value="small">Small</option>
                                    <option value="normal">Normal</option>
                                    <option value="large">Large</option>
                                </select>
                            </div>

                            {/* Items Font Size */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-600">Items (Qty, Name, MRP, Amount)</label>
                                <select
                                    className="w-full p-2 border rounded-md text-sm bg-white"
                                    defaultValue={localStorage.getItem('itemsFontSize') || 'normal'}
                                    onChange={(e) => localStorage.setItem('itemsFontSize', e.target.value)}
                                >
                                    <option value="small">Small</option>
                                    <option value="normal">Normal</option>
                                    <option value="large">Large</option>
                                </select>
                            </div>

                            {/* Footer Font Size */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-600">Footer (Thank You Message)</label>
                                <select
                                    className="w-full p-2 border rounded-md text-sm bg-white"
                                    defaultValue={localStorage.getItem('footerFontSize') || 'normal'}
                                    onChange={(e) => localStorage.setItem('footerFontSize', e.target.value)}
                                >
                                    <option value="small">Small</option>
                                    <option value="normal">Normal</option>
                                    <option value="large">Large</option>
                                </select>
                            </div>

                            {/* Font Style/Emphasis */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-600">Font Emphasis</label>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-2 border rounded bg-slate-50">
                                        <span className="text-sm">Bold Header</span>
                                        <input
                                            type="checkbox"
                                            defaultChecked={localStorage.getItem('boldHeader') !== 'false'}
                                            onChange={(e) => localStorage.setItem('boldHeader', String(e.target.checked))}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-2 border rounded bg-slate-50">
                                        <span className="text-sm">Bold Items</span>
                                        <input
                                            type="checkbox"
                                            defaultChecked={localStorage.getItem('boldItems') === 'true'}
                                            onChange={(e) => localStorage.setItem('boldItems', String(e.target.checked))}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-2 border rounded bg-slate-50">
                                        <span className="text-sm">Bold Footer</span>
                                        <input
                                            type="checkbox"
                                            defaultChecked={localStorage.getItem('boldFooter') === 'true'}
                                            onChange={(e) => localStorage.setItem('boldFooter', String(e.target.checked))}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 space-y-2">
                            <label className="text-xs font-medium uppercase text-slate-500">{t('footer_message')}</label>
                            <Input
                                placeholder="e.g. Thank You Visit Again"
                                defaultValue={localStorage.getItem('footerMessage') || '*** Thank You ***'}
                                onChange={(e) => localStorage.setItem('footerMessage', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium uppercase text-slate-500">{t('business_tagline')}</label>
                            <Input
                                placeholder="e.g. Best Quality Textiles"
                                defaultValue={localStorage.getItem('businessDescription') || ''}
                                onChange={(e) => localStorage.setItem('businessDescription', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2 pt-2 border-t">
                            <label className="text-xs font-medium uppercase text-slate-500">{t('bill_layout_order')}</label>
                            <p className="text-[10px] text-gray-500">Reorder sections for the bill print.</p>
                            <BillLayoutEditor />
                        </div>

                        <div className="pt-3 border-t">
                            <Button 
                                variant="outline" 
                                className="w-full"
                                onClick={() => setShowTemplatePreview(true)}
                            >
                                👁️ Preview Bill Templates
                            </Button>
                        </div>
                    </div>
                </CardContent>
                )}
            </Card>

            {/* Data Section */}
            <Card>
                <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSection('data')}>
                    <CardTitle className="text-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Database className="w-5 h-5" />
                            {t('data_backup')}
                        </div>
                        {collapsedSections.data ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                    </CardTitle>
                </CardHeader>
                {!collapsedSections.data && (
                <CardContent className="space-y-4">
                    {/* Auto Backup Section */}
                    <div className="bg-slate-50 p-3 rounded-lg border space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold flex items-center gap-2">
                                <Save className="w-4 h-4 text-blue-600" />
                                {t('auto_backup')}
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    className="scale-125"
                                    checked={backupConfig.enabled}
                                    onChange={(e) => {
                                        const newConfig = { ...backupConfig, enabled: e.target.checked };
                                        setBackupConfig(newConfig);
                                        saveBackupConfig(newConfig);
                                        if (e.target.checked) checkAndPerformBackup();
                                    }}
                                />
                                <span className="text-sm font-medium">{backupConfig.enabled ? 'On' : 'Off'}</span>
                            </div>
                        </div>

                        {backupConfig.enabled && (
                            <div className="pl-6 space-y-2 animate-in slide-in-from-top-2 fade-in">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium uppercase text-slate-500">{t('backup_frequency')}</label>
                                    <select
                                        className="w-full p-2 border rounded text-sm bg-white"
                                        value={backupConfig.frequency}
                                        onChange={(e) => {
                                            const newConfig = { ...backupConfig, frequency: e.target.value as any };
                                            setBackupConfig(newConfig);
                                            saveBackupConfig(newConfig);
                                        }}
                                    >
                                        <option value="hourly">Every Hour</option>
                                        <option value="daily">Daily</option>
                                        <option value="2days">Every 2 Days</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="custom">Custom Interval</option>
                                    </select>

                                    {backupConfig.frequency === 'custom' && (
                                        <div className="pt-2 animate-in slide-in-from-top-1">
                                            <label className="text-xs font-medium text-slate-500">Interval (in minutes)</label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="number"
                                                    min="15"
                                                    placeholder="Minutes (e.g. 30)"
                                                    value={backupConfig.customIntervalMinutes || ''}
                                                    onChange={(e) => {
                                                        const mins = parseInt(e.target.value) || 60;
                                                        const newConfig = { ...backupConfig, customIntervalMinutes: mins };
                                                        setBackupConfig(newConfig);
                                                        saveBackupConfig(newConfig);
                                                    }}
                                                />
                                                <span className="text-sm self-center">mins</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {lastBackup && (
                                    <p className="text-[10px] text-gray-500">
                                        Last Backup: {new Date(lastBackup).toLocaleString()}
                                    </p>
                                )}
                                <p className="text-[10px] text-blue-600 bg-blue-50 p-2 rounded">
                                    {Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios' 
                                        ? 'Files are saved to your device\'s Documents/Seematti_Backups folder. Access them using your file manager.' 
                                        : 'Files are saved to your device\'s Documents/Seematti_Backups folder.'}
                                </p>

                                {('showDirectoryPicker' in window) && (
                                    <div className="pt-2 border-t mt-2">
                                        <label className="text-xs font-medium uppercase text-slate-500">
                                            {Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios' 
                                                ? 'Backup Location (Mobile)' 
                                                : 'Backup Storage Location'}
                                        </label>
                                        <div className="flex items-center justify-between mt-1 p-2 border rounded bg-white">
                                            <div className="text-xs text-gray-700 font-medium">
                                                {Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios'
                                                    ? '📱 Mobile Device Storage'
                                                    : (isPwaFolderSet ? '✅ Local Folder Linked' : '⚠ Virtual Browser Storage')}
                                            </div>
                                            <Button size="sm" variant="outline" onClick={selectFolder}>
                                                {Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios'
                                                    ? 'View Info'
                                                    : (isPwaFolderSet ? 'Change Folder' : 'Select Folder')}
                                            </Button>
                                        </div>
                                        {isPwaFolderSet && (
                                            <div className="mt-2 text-right">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="text-xs"
                                                    onClick={async () => {
                                                        // Import dynamically if needed or just use import
                                                        /* 
                                                          Note: performBackup is imported at top. 
                                                          If not, I might need to make sure.
                                                          The previous lint said 'performBackup' declared but not read (line 11).
                                                          So it IS imported.
                                                        */
                                                        const result = await performBackup();
                                                        alert(result.message);
                                                    }}
                                                >
                                                    Test Backup & Verify Permission
                                                </Button>
                                            </div>
                                        )}
                                        {!isPwaFolderSet && (
                                            <p className="text-[10px] text-orange-600 mt-1 font-medium">
                                                Select a local folder to ensure backups are saved to your PC.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t">
                        <Button variant="outline" onClick={() => setShowBackupModal(true)} className="w-full justify-start">
                            {t('export_backup')}
                        </Button>
                        <Button variant="outline" onClick={handleRestore} className="w-full justify-start">
                            {t('restore_backup')}
                        </Button>
                        <p className="text-xs text-slate-500 mt-2">
                            Google Drive Sync can be implemented by uploading the exported JSON manually for now.
                        </p>
                    </div>
                </CardContent>
                )}
            </Card>

            {/* Sales Report Section */}
            <Card>
                <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSection('reports')}>
                    <CardTitle className="text-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Sales & Inventory Reports
                        </div>
                        {collapsedSections.reports ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                    </CardTitle>
                </CardHeader>
                {!collapsedSections.reports && (
                <CardContent className="space-y-3">
                    <p className="text-xs text-gray-500">Generate and print reports directly to your thermal printer</p>
                    
                    <div className="space-y-2">
                        <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => { setReportType('totalSales'); setShowReportModal(true); }}
                        >
                            📊 Total Sales Report
                        </Button>
                        
                        <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => { setReportType('itemSalesCount'); setShowReportModal(true); }}
                        >
                            📦 Item Sales Count
                        </Button>
                        
                        <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => { setReportType('todaySales'); setShowReportModal(true); }}
                        >
                            📅 Today's Sales
                        </Button>
                        
                        <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => { setReportType('weeklySales'); setShowReportModal(true); }}
                        >
                            📈 Weekly Sales Report
                        </Button>
                        
                        <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => { setReportType('monthlySales'); setShowReportModal(true); }}
                        >
                            📊 Monthly Sales Report
                        </Button>
                        
                        <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => { setReportType('inventoryReport'); setShowReportModal(true); }}
                        >
                            📋 Inventory Report by Category
                        </Button>
                    </div>
                </CardContent>
                )}
            </Card>

            {showBackupModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm space-y-4 animate-in zoom-in-95">
                        <h3 className="text-lg font-bold">Export Backup</h3>
                        <p className="text-sm text-gray-500">Select which data profile you want to export.</p>

                        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                            <div className="flex items-center gap-2 p-2 border rounded hover:bg-slate-50 cursor-pointer" onClick={() => setBackupProfileId('all')}>
                                <input type="radio" checked={backupProfileId === 'all'} onChange={() => setBackupProfileId('all')} />
                                <span className="font-medium text-sm">Full System Backup (All Profiles)</span>
                            </div>

                            {profiles?.map(p => (
                                <div key={p.id} className="flex items-center gap-2 p-2 border rounded hover:bg-slate-50 cursor-pointer" onClick={() => setBackupProfileId(String(p.id))}>
                                    <input type="radio" checked={backupProfileId === String(p.id)} onChange={() => setBackupProfileId(String(p.id))} />
                                    <span className="font-medium text-sm">{p.businessName}</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setShowBackupModal(false)}>Cancel</Button>
                            <Button className="flex-1" onClick={performExport}>Export</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bluetooth Modal */}
            {showBtModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm space-y-4 animate-in zoom-in-95 flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold">Select Printer</h3>
                            <Button size="sm" variant="ghost" onClick={() => setShowBtModal(false)}>Close</Button>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                className="w-full text-xs"
                                onClick={scanUnpaired}
                                disabled={isScanningBt}
                            >
                                {isScanningBt ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                                Scan for New Devices
                            </Button>
                        </div>

                        <div className="space-y-2 overflow-y-auto flex-1">
                            {btDevices.length === 0 ? (
                                <div className="text-center text-gray-500 py-4 text-sm">
                                    No devices found. Ensure Bluetooth is on.
                                </div>
                            ) : (
                                btDevices.map((device, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3 border rounded hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                                        onClick={() => connectToDevice(device)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm">{device.name || 'Unknown Device'}</span>
                                            <span className="text-xs text-gray-500">{device.address}</span>
                                        </div>
                                        <Bluetooth className="w-4 h-4 text-blue-500" />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Sales Report Modal */}
            {showReportModal && (
                <SalesReportModal 
                    reportType={reportType}
                    reportDateType={reportDateType}
                    selectedMonth={selectedMonth}
                    startDate={startDate}
                    endDate={endDate}
                    reportProfileId={reportProfileId}
                    profiles={profiles || []}
                    onDateTypeChange={setReportDateType}
                    onMonthChange={setSelectedMonth}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onProfileChange={setReportProfileId}
                    onClose={() => setShowReportModal(false)}
                    onPrint={async (reportData) => {
                        setIsPrinting(true);
                        try {
                            await printReport(reportData);
                            alert('✅ Report printed successfully!');
                            setShowReportModal(false);
                        } catch (error) {
                            alert(`❌ Print failed: ${error}`);
                        } finally {
                            setIsPrinting(false);
                        }
                    }}
                    isPrinting={isPrinting}
                />
            )}
            
            {/* Bill Template Preview Modal */}
            {showTemplatePreview && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
                            <h3 className="text-lg font-bold">Bill Template Preview</h3>
                            <Button size="sm" variant="ghost" onClick={() => setShowTemplatePreview(false)}>✕</Button>
                        </div>
                        
                        <div className="p-4 space-y-4">
                            {/* Cash Bill Preview */}
                            <div>
                                <h4 className="font-bold text-sm mb-2 text-blue-600">💰 Cash Bill Sample</h4>
                                <ThermalBillPreview type="cash" />
                            </div>

                            {/* Credit Bill Preview */}
                            <div>
                                <h4 className="font-bold text-sm mb-2 text-orange-600">📝 Credit Bill Sample</h4>
                                <ThermalBillPreview type="credit" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};



const BillLayoutEditor = () => {
    const { t } = useTranslation();
    const defaultOrder = [
        { id: 'logo', label: 'show_logo' },
        { id: 'shopName', label: 'show_shop_name' },
        { id: 'description', label: 'business_tagline' },
        { id: 'address', label: 'show_address' },
        { id: 'phone', label: 'show_phone' },
        { id: 'billMeta', label: 'bill_meta' },
        { id: 'items', label: 'items_list' },
        { id: 'totals', label: 'totals_summary' },
        { id: 'qrcode', label: 'show_qr_code' },
        { id: 'footer', label: 'footer_message' }
    ];

    const [order, setOrder] = useState(() => {
        const saved = localStorage.getItem('billLayoutOrder');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Merge with default in case of new keys, or just use saved. 
            // For simplicity, map saved IDs back to full objects.
            return parsed.map((id: string) => defaultOrder.find(o => o.id === id) || { id, label: id });
        }
        return defaultOrder;
    });

    const move = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...order];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newOrder.length) return;

        [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
        setOrder(newOrder);
        localStorage.setItem('billLayoutOrder', JSON.stringify(newOrder.map(o => o.id)));
    };

    return (
        <div className="space-y-1 bg-slate-50 p-2 rounded">
            {order.map((item: { id: string; label: string }, index: number) => (
                <div key={item.id} className="flex items-center justify-between text-sm bg-white p-2 border rounded">
                    <span>{t(item.label)}</span>
                    <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={index === 0} onClick={() => move(index, 'up')}>
                            <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={index === order.length - 1} onClick={() => move(index, 'down')}>
                            <ArrowDown className="w-3 h-3" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
};

// Sales Report Modal Component
const SalesReportModal = ({ reportType, reportDateType, selectedMonth, startDate, endDate, reportProfileId, profiles, onDateTypeChange, onMonthChange, onStartDateChange, onEndDateChange, onProfileChange, onClose, onPrint, isPrinting }: {
    reportType: string;
    reportDateType: 'month' | 'dateRange';
    selectedMonth: string;
    startDate: string;
    endDate: string;
    reportProfileId: number | 'all';
    profiles: Profile[];
    onDateTypeChange: (type: 'month' | 'dateRange') => void;
    onMonthChange: (month: string) => void;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    onProfileChange: (profileId: number | 'all') => void;
    onClose: () => void;
    onPrint: (content: string) => void;
    isPrinting: boolean;
}) => {
    const [reportContent, setReportContent] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        generateReport();
    }, [reportType, reportDateType, selectedMonth, startDate, endDate, reportProfileId]);

    const generateReport = async () => {
        setLoading(true);
        let content = '';
        const now = new Date();
        
        try {
            switch (reportType) {
                case 'totalSales': {
                    let bills = await db.bills.toArray();
                    if (reportProfileId !== 'all') {
                        bills = bills.filter(bill => bill.profileId === reportProfileId);
                    }
                    const totalAmount = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
                    const totalBills = bills.length;
                    
                    content = `## TOTAL SALES REPORT\n`;
                    content += `---\n`;
                    content += `Generated: ${now.toLocaleString()}\n`;
                    content += `===\n`;
                    content += `**Total Bills**: ${totalBills}\n`;
                    content += `**Total Sales**: Rs${totalAmount.toFixed(2)}\n`;
                    content += `**Average Bill**: Rs${totalBills > 0 ? (totalAmount / totalBills).toFixed(2) : 0}\n`;
                    content += `===\n`;
                    break;
                }
                
                case 'itemSalesCount': {
                    let bills = await db.bills.toArray();
                    if (reportProfileId !== 'all') {
                        bills = bills.filter(bill => bill.profileId === reportProfileId);
                    }
                    const itemMap = new Map<string, { count: number; quantity: number }>();
                    
                    bills.forEach(bill => {
                        bill.items.forEach(item => {
                            const itemName = item.englishName || item.name;
                            const existing = itemMap.get(itemName) || { count: 0, quantity: 0 };
                            itemMap.set(itemName, {
                                count: existing.count + 1,
                                quantity: existing.quantity + item.quantity
                            });
                        });
                    });
                    
                    content = `## ITEM SALES COUNT\n`;
                    content += `---\n`;
                    content += `Generated: ${now.toLocaleString()}\n`;
                    content += `===\n`;
                    content += `Item Name              Bills  Qty\n`;
                    content += `---\n`;
                    
                    Array.from(itemMap.entries())
                        .sort((a, b) => b[1].count - a[1].count)
                        .forEach(([name, data]) => {
                            const itemName = name.substring(0, 20).padEnd(22, ' ');
                            const billCount = data.count.toString().padStart(5, ' ');
                            const qty = data.quantity.toString().padStart(5, ' ');
                            content += `${itemName}${billCount}${qty}\n`;
                        });
                    
                    content += `===\n`;
                    break;
                }
                
                case 'todaySales': {
                    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    let bills = await db.bills.filter(bill => 
                        new Date(bill.date) >= startOfDay
                    ).toArray();
                    if (reportProfileId !== 'all') {
                        bills = bills.filter(bill => bill.profileId === reportProfileId);
                    }
                    
                    const totalAmount = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
                    
                    content = `## TODAY'S SALES\n`;
                    content += `---\n`;
                    content += `Date: ${now.toLocaleDateString()}\n`;
                    content += `===\n`;
                    content += `**Total Bills**: ${bills.length}\n`;
                    content += `**Total Sales**: Rs${totalAmount.toFixed(2)}\n`;
                    content += `===\n`;
                    content += `Recent Bills:\n`;
                    content += `---\n`;
                    
                    bills.slice(-10).reverse().forEach(bill => {
                        const time = new Date(bill.date).toLocaleTimeString();
                        content += `#${bill.billNo} ${time} Rs${bill.totalAmount.toFixed(0)}\n`;
                    });
                    
                    content += `===\n`;
                    break;
                }
                
                case 'weeklySales': {
                    const startOfWeek = new Date(now);
                    startOfWeek.setDate(now.getDate() - 7);
                    let bills = await db.bills.filter(bill => 
                        new Date(bill.date) >= startOfWeek
                    ).toArray();
                    if (reportProfileId !== 'all') {
                        bills = bills.filter(bill => bill.profileId === reportProfileId);
                    }
                    
                    const totalAmount = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
                    const dailySales = new Map<string, number>();
                    
                    bills.forEach(bill => {
                        const date = new Date(bill.date).toLocaleDateString();
                        dailySales.set(date, (dailySales.get(date) || 0) + bill.totalAmount);
                    });
                    
                    content = `## WEEKLY SALES REPORT\n`;
                    content += `---\n`;
                    content += `Period: Last 7 Days\n`;
                    content += `Generated: ${now.toLocaleString()}\n`;
                    content += `===\n`;
                    content += `**Total Bills**: ${bills.length}\n`;
                    content += `**Total Sales**: Rs${totalAmount.toFixed(2)}\n`;
                    content += `**Daily Average**: Rs${(totalAmount / 7).toFixed(2)}\n`;
                    content += `===\n`;
                    content += `Daily Breakdown:\n`;
                    content += `---\n`;
                    
                    Array.from(dailySales.entries()).forEach(([date, amount]) => {
                        content += `${date}: Rs${amount.toFixed(2)}\n`;
                    });
                    
                    content += `===\n`;
                    break;
                }
                
                case 'monthlySales': {
                    let bills;
                    let dateLabel = '';
                    
                    if (reportDateType === 'month') {
                        // Month-based report
                        const [year, month] = selectedMonth.split('-').map(Number);
                        const startOfMonth = new Date(year, month - 1, 1);
                        const endOfMonth = new Date(year, month, 0, 23, 59, 59);
                        
                        bills = await db.bills.filter(bill => {
                            const billDate = new Date(bill.date);
                            return billDate >= startOfMonth && billDate <= endOfMonth;
                        }).toArray();
                        
                        dateLabel = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    } else {
                        // Date range report
                        const start = new Date(startDate);
                        start.setHours(0, 0, 0, 0);
                        const end = new Date(endDate);
                        end.setHours(23, 59, 59, 999);
                        
                        bills = await db.bills.filter(bill => {
                            const billDate = new Date(bill.date);
                            return billDate >= start && billDate <= end;
                        }).toArray();
                        
                        dateLabel = `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
                    }
                    
                    if (reportProfileId !== 'all') {
                        bills = bills.filter(bill => bill.profileId === reportProfileId);
                    }
                    
                    const totalAmount = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
                    const paymentModes = bills.reduce((acc: any, bill) => {
                        acc[bill.paymentMode] = (acc[bill.paymentMode] || 0) + bill.totalAmount;
                        return acc;
                    }, {});
                    
                    content = `## SALES REPORT\n`;
                    content += `---\n`;
                    content += `Period: ${dateLabel}\n`;
                    content += `Generated: ${now.toLocaleString()}\n`;
                    content += `===\n`;
                    content += `**Total Bills**: ${bills.length}\n`;
                    content += `**Total Sales**: Rs${totalAmount.toFixed(2)}\n`;
                    content += `===\n`;
                    content += `Payment Methods:\n`;
                    content += `---\n`;
                    
                    Object.entries(paymentModes).forEach(([mode, amount]) => {
                        content += `${mode.toUpperCase()}: Rs${(amount as number).toFixed(2)}\n`;
                    });
                    
                    content += `===\n`;
                    break;
                }
                
                case 'inventoryReport': {
                    let items = await db.items.toArray();
                    if (reportProfileId !== 'all') {
                        items = items.filter(item => item.profileId === reportProfileId);
                    }
                    let categories = await db.categories.toArray();
                    if (reportProfileId !== 'all') {
                        categories = categories.filter(cat => cat.profileId === reportProfileId);
                    }
                    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
                    
                    content = `## INVENTORY REPORT\n`;
                    content += `---\n`;
                    content += `Generated: ${now.toLocaleString()}\n`;
                    content += `===\n`;
                    content += `**Total Items**: ${items.length}\n`;
                    content += `===\n`;
                    
                    const itemsByCategory = items.reduce((acc: any, item) => {
                        const catName = item.categoryId ? categoryMap.get(item.categoryId) || 'Uncategorized' : 'Uncategorized';
                        if (!acc[catName]) acc[catName] = [];
                        acc[catName].push(item);
                        return acc;
                    }, {});
                    
                    Object.entries(itemsByCategory).forEach(([category, categoryItems]) => {
                        content += `\n**${category}** (${(categoryItems as any[]).length} items)\n`;
                        content += `---\n`;
                        content += `Item Name         Stock  Price\n`;
                        
                        (categoryItems as any[]).forEach(item => {
                            const name = (item.englishName || item.name).substring(0, 15).padEnd(17, ' ');
                            const stock = item.stock.toString().padStart(5, ' ');
                            const price = item.price.toString().padStart(7, ' ');
                            content += `${name}${stock}${price}\n`;
                        });
                    });
                    
                    content += `===\n`;
                    break;
                }
            }
            
            setReportContent(content);
        } catch (error) {
            content = `Error generating report: ${error}`;
            setReportContent(content);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
                    <h3 className="text-lg font-bold">Report Preview</h3>
                    <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
                </div>
                
                <div className="p-4">
                    {/* Profile Selection - Show if multiple profiles exist */}
                    {profiles.length > 1 && (
                        <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Profile</label>
                            <select
                                className="w-full p-2 border rounded-md text-sm bg-white"
                                value={reportProfileId}
                                onChange={(e) => onProfileChange(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                            >
                                <option value="all">All Profiles</option>
                                {profiles.map(profile => (
                                    <option key={profile.id} value={profile.id}>
                                        {profile.businessName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    
                    {/* Date Selection for Monthly Sales Report */}
                    {reportType === 'monthlySales' && (
                        <div className="mb-4 space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="dateType"
                                        checked={reportDateType === 'month'}
                                        onChange={() => onDateTypeChange('month')}
                                    />
                                    <span className="text-sm font-medium">By Month</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="dateType"
                                        checked={reportDateType === 'dateRange'}
                                        onChange={() => onDateTypeChange('dateRange')}
                                    />
                                    <span className="text-sm font-medium">By Date Range</span>
                                </label>
                            </div>

                            {reportDateType === 'month' ? (
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Select Month</label>
                                    <Input
                                        type="month"
                                        value={selectedMonth}
                                        onChange={(e) => onMonthChange(e.target.value)}
                                        className="w-full"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                                        <Input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => onStartDateChange(e.target.value)}
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                                        <Input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => onEndDateChange(e.target.value)}
                                            className="w-full"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {loading ? (
                        <div className="text-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                            <p className="text-sm text-gray-500 mt-2">Generating report...</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-gray-50 p-4 rounded font-mono text-xs whitespace-pre-line mb-4 max-h-96 overflow-y-auto">
                                {reportContent}
                            </div>
                            
                            <Button 
                                className="w-full"
                                onClick={() => onPrint(reportContent)}
                                disabled={isPrinting}
                            >
                                {isPrinting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Printing...
                                    </>
                                ) : (
                                    <>
                                        <Printer className="w-4 h-4 mr-2" />
                                        Print Report
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// Thermal Bill Preview Component
const ThermalBillPreview = ({ type }: { type: 'cash' | 'credit' }) => {
    const profiles = useLiveQuery(() => db.profiles.toArray());
    const profile = profiles?.[0] || {
        businessName: 'Sample Business',
        address: '123 Main Street\nCity, State 12345',
        phone: '+91 98765 43210'
    };

    const paperWidth = localStorage.getItem('printerPaperSize') || '58mm';
    const showLogo = localStorage.getItem('showLogo') !== 'false';
    const showShopName = localStorage.getItem('showShopName') !== 'false';
    const showAddress = localStorage.getItem('showAddress') !== 'false';
    const showPhone = localStorage.getItem('showPhone') !== 'false';
    const showMrp = localStorage.getItem('showMrp') !== 'false';
    const showSavings = localStorage.getItem('showSavings') !== 'false';
    const showQrCode = localStorage.getItem('showQrCode') !== 'false';
    const showFooter = localStorage.getItem('showFooter') !== 'false';
    const footerMessage = localStorage.getItem('footerMessage') || '*** Thank You ***';
    const businessDescription = localStorage.getItem('businessDescription') || '';
    const upiId = localStorage.getItem('upiId') || '';

    // Font size and style settings
    const shopNameFontSize = localStorage.getItem('shopNameFontSize') || 'normal';
    const headerFontSize = localStorage.getItem('headerFontSize') || 'normal';
    const itemsFontSize = localStorage.getItem('itemsFontSize') || 'normal';
    const footerFontSize = localStorage.getItem('footerFontSize') || 'normal';
    const boldHeader = localStorage.getItem('boldHeader') !== 'false';
    const boldItems = localStorage.getItem('boldItems') === 'true';
    const boldFooter = localStorage.getItem('boldFooter') === 'true';

    // Font size mapping to CSS classes
    const fontSizeClasses: Record<string, string> = {
        small: 'text-[8px]',
        normal: 'text-[10px]',
        large: 'text-[14px]',
        xlarge: 'text-[18px]'
    };

    const sampleItems = [
        { name: 'Sample Item 1', quantity: 2, price: 100, mrp: 120, unit: 'pieces' },
        { name: 'Sample Item 2', quantity: 1, price: 250, mrp: 280, unit: 'kg' },
    ];

    const subTotal = sampleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalMrp = sampleItems.reduce((sum, item) => sum + (item.mrp * item.quantity), 0);
    const savings = totalMrp - subTotal;
    const discount = 0;
    const totalAmount = subTotal - discount;
    const paidAmount = type === 'credit' ? 200 : totalAmount;
    const billDue = totalAmount - paidAmount;
    const previousBalance = type === 'credit' ? 1500 : 0; // Sample previous outstanding
    const netBalance = previousBalance + billDue;

    return (
        <div className="bg-white border-2 border-gray-300 rounded p-3 font-mono text-[10px] leading-tight" style={{ width: paperWidth === '80mm' ? '300px' : '230px' }}>
            {/* Logo */}
            {showLogo && (
                <div className="text-center mb-2">
                    <div className="inline-block border-2 border-dashed border-gray-400 rounded p-2 bg-gray-50">
                        <div className="text-xs text-gray-500">LOGO</div>
                        <div className="text-[8px] text-gray-400">(Image)</div>
                    </div>
                </div>
            )}

            {/* Shop Name */}
            {showShopName && (
                <div className={`text-center mb-1 ${fontSizeClasses[shopNameFontSize]} ${boldHeader ? 'font-bold' : 'font-normal'}`}>
                    {profile.businessName}
                </div>
            )}

            {/* Business Description */}
            {businessDescription && (
                <div className={`text-center mb-1 ${fontSizeClasses[headerFontSize]} ${boldHeader ? 'font-bold' : 'font-normal'}`}>
                    {businessDescription}
                </div>
            )}

            {/* Address */}
            {showAddress && (
                <div className={`text-center mb-1 whitespace-pre-line ${fontSizeClasses[headerFontSize]} ${boldHeader ? 'font-bold' : 'font-normal'}`}>
                    {profile.address}
                </div>
            )}

            {/* Phone */}
            {showPhone && (
                <div className={`text-center mb-1 ${fontSizeClasses[headerFontSize]} ${boldHeader ? 'font-bold' : 'font-normal'}`}>
                    {profile.phone}
                </div>
            )}

            {/* Separator */}
            <div className="border-t border-gray-400 my-1"></div>

            {/* Bill Meta */}
            <div className={`mb-1 ${fontSizeClasses[headerFontSize]}`}>
                <div>Bill: #001</div>
                <div>Date: {new Date().toLocaleDateString()}</div>
                <div>Time: {new Date().toLocaleTimeString()}</div>
                {type === 'cash' && <div>Customer: Walk-in</div>}
                {type === 'credit' && <div>Party: Sample Party</div>}
            </div>

            {/* Credit Bill Indicator */}
            {type === 'credit' && (
                <div className="text-center font-bold text-[10px] bg-orange-100 py-1 my-1">
                    CASH/CREDIT BILL
                </div>
            )}

            {/* Separator */}
            <div className="border-t border-gray-400 my-1"></div>

            {/* Items Header */}
            <div className={`font-bold flex ${fontSizeClasses[itemsFontSize]}`}>
                <span style={{ width: '15%' }}>Qty</span>
                <span style={{ width: showMrp ? '45%' : '60%' }}>Item</span>
                {showMrp && <span style={{ width: '20%' }} className="text-right">MRP</span>}
                <span style={{ width: '20%' }} className="text-right">Amt</span>
            </div>
            
            {/* Separator below header */}
            <div className="border-t border-dashed border-gray-400 mt-0.5 mb-1"></div>

            {/* Items */}
            {sampleItems.map((item, i) => (
                <div key={i} className={`flex py-0.5 ${fontSizeClasses[itemsFontSize]} ${boldItems ? 'font-bold' : 'font-normal'}`}>
                    <span style={{ width: '15%' }}>{item.quantity}</span>
                    <span style={{ width: showMrp ? '45%' : '60%' }} className="truncate">
                        {item.name} ({item.unit})
                    </span>
                    {showMrp && <span style={{ width: '20%' }} className="text-right">{item.mrp}</span>}
                    <span style={{ width: '20%' }} className="text-right">{item.price * item.quantity}</span>
                </div>
            ))}

            {/* Separator */}
            <div className="border-t border-gray-400 my-1"></div>

            {/* Totals */}
            <div className={`font-bold flex ${fontSizeClasses[itemsFontSize]}`}>
                <span style={{ width: '15%' }}>{sampleItems.reduce((s, i) => s + i.quantity, 0)}</span>
                <span style={{ width: showMrp ? '45%' : '60%' }}>Total</span>
                {showMrp && <span style={{ width: '20%' }} className="text-right">{totalMrp}</span>}
                <span style={{ width: '20%' }} className="text-right">{subTotal}</span>
            </div>

            {/* Separator */}
            <div className="border-t border-gray-400 my-1"></div>

            {/* Discount */}
            {discount > 0 && (
                <div className="text-[9px] flex justify-between">
                    <span>Discount</span>
                    <span>Rs{discount}</span>
                </div>
            )}

            {/* Grand Total */}
            <div className="text-center font-bold text-sm my-1">
                GRAND TOTAL: Rs{totalAmount}
            </div>

            {/* Credit Details */}
            {type === 'credit' && (
                <div className="text-[9px] border-t border-gray-400 pt-1 space-y-0.5">
                    <div className="flex justify-between">
                        <span>Paid Now</span>
                        <span>Rs{paidAmount}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                        <span>Bill Due</span>
                        <span>Rs{billDue}</span>
                    </div>
                    <div className="border-t border-dashed border-gray-300 my-1"></div>
                    <div className="flex justify-between text-[8px] text-gray-600">
                        <span>Previous Balance</span>
                        <span>Rs{previousBalance}</span>
                    </div>
                    <div className="flex justify-between font-bold text-[10px]">
                        <span>Net Balance</span>
                        <span>Rs{netBalance}</span>
                    </div>
                </div>
            )}

            {/* Savings */}
            {showSavings && savings > 0 && (
                <div className="text-center font-bold text-[10px] my-1 text-green-600">
                    You Saved: Rs{savings}
                </div>
            )}

            {/* QR Code */}
            {showQrCode && upiId && (
                <div className="text-center my-2 space-y-1">
                    <div className="text-[9px]">Scan to Pay</div>
                    <div className="bg-gray-200 h-16 flex items-center justify-center text-[8px]">
                        [QR CODE]<br/>Rs{totalAmount}
                    </div>
                </div>
            )}

            {/* Footer */}
            {showFooter && (
                <div className={`text-center mt-2 ${fontSizeClasses[footerFontSize]} ${boldFooter ? 'font-bold' : 'font-normal'}`}>
                    <div>{footerMessage}</div>
                </div>
            )}
        </div>
    );
};

export default Settings;

