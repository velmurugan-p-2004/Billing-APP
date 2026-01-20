import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { db, Profile } from '@/db/db';
import { GoogleDriveSync } from '@/components/GoogleDriveSync';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Globe, Database, Printer, ArrowUp, ArrowDown, Bluetooth, Usb, Save } from 'lucide-react';
import { compressImage } from '@/lib/imageUtils';
import { getBackupConfig, saveBackupConfig, AutoBackupConfig, performBackup, getLastBackupTime, checkAndPerformBackup } from '@/utils/backupManager';

const Settings = () => {
    const { t, i18n } = useTranslation();
    const profiles = useLiveQuery(() => db.profiles.toArray());
    const [isEditing, setIsEditing] = useState(false);
    const [newProfile, setNewProfile] = useState<Partial<Profile>>({});
    const [connectionType, setConnectionType] = useState(localStorage.getItem('printerConnectionType') || 'usb');
    const [btDeviceName, setBtDeviceName] = useState(localStorage.getItem('bluetoothDeviceName') || '');
    const [backupConfig, setBackupConfig] = useState<AutoBackupConfig>(getBackupConfig());
    const [lastBackup, setLastBackup] = useState<string | null>(getLastBackupTime());
    const [showBackupModal, setShowBackupModal] = useState(false);
    const [backupProfileId, setBackupProfileId] = useState<string>('all');
    const [isPwaFolderSet, setIsPwaFolderSet] = useState(false);

    useEffect(() => {
        db.appConfig.get('backupFolderHandle').then(h => {
            // In browser, handle might need verification but presence is good enough indicator
            setIsPwaFolderSet(!!h);
        });
    }, []);

    const selectFolder = async () => {
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
    };

    const handleSaveProfile = async () => {
        if (!newProfile.businessName) return;

        const profileData = {
            businessName: newProfile.businessName || '',
            address: newProfile.address || '',
            phone: newProfile.phone || '',
            upiId: newProfile.upiId || '',
            logo: newProfile.logo || ''
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
        const allItems = await db.items.toArray();
        const allBills = await db.bills.toArray();
        const allProfiles = await db.profiles.toArray();
        const allCategories = await db.categories.toArray();
        const allParties = await db.parties.toArray();
        const allTrans = await db.partyTransactions.toArray();

        let exportData: any = {};

        if (backupProfileId === 'all') {
            exportData = {
                profiles: allProfiles,
                items: allItems,
                bills: allBills,
                categories: allCategories,
                parties: allParties,
                transactions: allTrans,
                timestamp: new Date().toISOString()
            };
        } else {
            const pid = Number(backupProfileId);
            const profile = allProfiles.find(p => p.id === pid);
            exportData = {
                profile: profile,
                items: allItems.filter(i => i.profileId === pid),
                bills: allBills.filter(b => b.profileId === pid),
                categories: allCategories.filter(c => c.profileId === pid),
                parties: allParties.filter(p => p.profileId === pid),
                transactions: allTrans.filter(t => t.profileId === pid),
                timestamp: new Date().toISOString()
            };
        }

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const prefix = backupProfileId === 'all' ? 'Seematti_Full' : `Seematti_${allProfiles.find(p => p.id === Number(backupProfileId))?.businessName.replace(/[^a-z0-9]/gi, '_') || 'Profile'}`;
        a.download = `${prefix}_Backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        setShowBackupModal(false);
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
                    const data = JSON.parse(event.target?.result as string);
                    await db.transaction('rw', db.items, db.bills, db.profiles, async () => {
                        await db.items.clear();
                        await db.bills.clear();
                        await db.profiles.clear();

                        await db.items.bulkAdd(data.items || []);
                        await db.bills.bulkAdd(data.bills || []);
                        await db.profiles.bulkAdd(data.profiles || []);
                    });
                    alert("Restore Successful!");
                } catch (err) {
                    console.error(err);
                    alert("Restore Failed");
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const connectBluetooth = async () => {
        try {
            const device = await (navigator as any).bluetooth.requestDevice({
                filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }]
            });
            if (device) {
                setBtDeviceName(device.name);
                localStorage.setItem('bluetoothDeviceName', device.name);
                localStorage.setItem('printerConnectionType', 'bluetooth');
                setConnectionType('bluetooth');
                alert(`Connected to ${device.name}`);
            }
        } catch (e) {
            console.error(e);
            alert("Bluetooth Pairing Failed");
        }
    };

    return (
        <div className="p-4 space-y-6 max-w-md mx-auto pb-24">
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

                            <div className="flex gap-2 justify-end mt-2">
                                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>{t('cancel')}</Button>
                                <Button size="sm" onClick={handleSaveProfile}>{t('save')}</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
                <div className="p-4 border-t bg-gray-50 rounded-b-lg">
                    <label className="text-xs font-medium uppercase text-slate-500 block mb-2">Default Business Profile</label>
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
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Printer className="w-5 h-5" />
                        Printer & Template
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-medium uppercase text-slate-500">Default Printer Type</label>
                        <select
                            className="w-full p-2 border rounded-md text-sm"
                            onChange={(e) => {
                                localStorage.setItem('defaultPrinterType', e.target.value);
                                alert('Default printer saved');
                            }}
                            defaultValue={localStorage.getItem('defaultPrinterType') || 'thermal'}
                        >
                            <option value="ask">Always Ask</option>
                            <option value="thermal">Thermal (58mm/80mm)</option>
                            <option value="a4">A4 Professional</option>
                        </select>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                        <label className="text-xs font-medium uppercase text-slate-500">Printer Connection Interface</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div
                                className={`p-3 border rounded cursor-pointer flex flex-col items-center gap-2 ${connectionType === 'usb' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-slate-50'}`}
                                onClick={() => {
                                    setConnectionType('usb');
                                    localStorage.setItem('printerConnectionType', 'usb');
                                }}
                            >
                                <Usb className="w-6 h-6" />
                                <span className="text-xs font-bold">USB / System</span>
                            </div>
                            <div
                                className={`p-3 border rounded cursor-pointer flex flex-col items-center gap-2 ${connectionType === 'bluetooth' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-slate-50'}`}
                                onClick={() => {
                                    setConnectionType('bluetooth');
                                    localStorage.setItem('printerConnectionType', 'bluetooth');
                                }}
                            >
                                <Bluetooth className="w-6 h-6" />
                                <span className="text-xs font-bold">Bluetooth</span>
                            </div>
                        </div>

                        {connectionType === 'bluetooth' && (
                            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded text-sm space-y-2">
                                <p className="text-xs text-gray-600">
                                    Directly connect to a thermal printer.
                                </p>
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-xs">
                                        {btDeviceName ? `Paired: ${btDeviceName}` : 'No device paired'}
                                    </span>
                                    <Button size="sm" variant="outline" onClick={connectBluetooth}>
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
                        <label className="text-xs font-medium uppercase text-slate-500">Bill Template Options</label>
                        <div className="space-y-2">
                            {[
                                { id: 'showShopName', label: 'Show Shop Name' },
                                { id: 'showAddress', label: 'Show Address' },
                                { id: 'showPhone', label: 'Show Phone Number' },
                                { id: 'showLogo', label: 'Show Logo' },
                                { id: 'showFooter', label: 'Show Footer' },
                                { id: 'showSavings', label: 'Show MRP Savings' },
                            ].map((opt) => (
                                <div key={opt.id} className="flex items-center justify-between p-2 border rounded bg-slate-50">
                                    <span className="text-sm">{opt.label}</span>
                                    <input
                                        type="checkbox"
                                        defaultChecked={localStorage.getItem(opt.id) !== 'false'}
                                        onChange={(e) => localStorage.setItem(opt.id, String(e.target.checked))}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="pt-2 space-y-2">
                            <label className="text-xs font-medium uppercase text-slate-500">Footer Message</label>
                            <Input
                                placeholder="e.g. Thank You Visit Again"
                                defaultValue={localStorage.getItem('footerMessage') || '*** Thank You ***'}
                                onChange={(e) => localStorage.setItem('footerMessage', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium uppercase text-slate-500">Business Tagline / Description</label>
                            <Input
                                placeholder="e.g. Best Quality Textiles"
                                defaultValue={localStorage.getItem('businessDescription') || ''}
                                onChange={(e) => localStorage.setItem('businessDescription', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2 pt-2 border-t">
                            <label className="text-xs font-medium uppercase text-slate-500">Bill Layout Order</label>
                            <p className="text-[10px] text-gray-500">Reorder sections for the bill print.</p>
                            <BillLayoutEditor />
                        </div>
                    </div>
                </CardContent>
            </Card>





            {/* Data Section */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        Data & Backup
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Auto Backup Section */}
                    <div className="bg-slate-50 p-3 rounded-lg border space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold flex items-center gap-2">
                                <Save className="w-4 h-4 text-blue-600" />
                                Automatic Device Backup
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
                                    <label className="text-xs font-medium uppercase text-slate-500">Backup Frequency</label>
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
                                    Files are saved to your device's <b>Documents/Seematti_Backups</b> folder.
                                </p>

                                {('showDirectoryPicker' in window) && (
                                    <div className="pt-2 border-t mt-2">
                                        <label className="text-xs font-medium uppercase text-slate-500">Backup Storage Location</label>
                                        <div className="flex items-center justify-between mt-1 p-2 border rounded bg-white">
                                            <div className="text-xs text-gray-700 font-medium">
                                                {isPwaFolderSet ? '✅ Local Folder Linked' : '⚠ Virtual Browser Storage'}
                                            </div>
                                            <Button size="sm" variant="outline" onClick={selectFolder}>
                                                {isPwaFolderSet ? 'Change Folder' : 'Select Folder'}
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
                            Export Backup (JSON)
                        </Button>
                        <Button variant="outline" onClick={handleRestore} className="w-full justify-start">
                            Restore from Backup
                        </Button>
                        <p className="text-xs text-slate-500 mt-2">
                            Google Drive Sync can be implemented by uploading the exported JSON manually for now.
                        </p>
                    </div>
                </CardContent>
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
        </div >
    );
};



const BillLayoutEditor = () => {
    const defaultOrder = [
        { id: 'logo', label: 'Logo' },
        { id: 'shopName', label: 'Shop Name' },
        { id: 'description', label: 'Description' },
        { id: 'address', label: 'Address' },
        { id: 'phone', label: 'Phone' },
        { id: 'billMeta', label: 'Bill No & Date' },
        { id: 'items', label: 'Items List' },
        { id: 'totals', label: 'Totals (Amt, Disc, Save)' },
        { id: 'footer', label: 'Footer Message' }
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
                    <span>{item.label}</span>
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

export default Settings;
