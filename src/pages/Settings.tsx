import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { db, Profile } from '@/db/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Globe, Database, Printer, ArrowUp, ArrowDown } from 'lucide-react';
import { compressImage } from '@/lib/imageUtils';
import { GoogleDriveSync } from '@/components/GoogleDriveSync';

const Settings = () => {
    const { t, i18n } = useTranslation();
    const profiles = useLiveQuery(() => db.profiles.toArray());
    const [isEditing, setIsEditing] = useState(false);
    const [newProfile, setNewProfile] = useState<Partial<Profile>>({});

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

    const handleBackup = async () => {
        const allData = {
            profiles: await db.profiles.toArray(),
            items: await db.items.toArray(),
            bills: await db.bills.toArray(),
            timestamp: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `seematti_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
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

    return (
        <div className="p-4 space-y-6 max-w-md mx-auto pb-24">
            <h1 className="text-2xl font-bold">{t('settings')}</h1>

            {/* Google Drive Sync Section */}
            <GoogleDriveSync />

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

            {/* Google Drive Section */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        Google Drive Backup
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <GoogleDriveManager profiles={profiles} />
                </CardContent>
            </Card>

            {/* App Info Section */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <div className="w-5 h-5 bg-blue-600 rounded-sm flex items-center justify-center text-white text-xs font-bold">S</div>
                        {t('app_info')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-3 bg-slate-50 border rounded-lg text-sm space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Version</span>
                            <span className="font-medium">1.0.0</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Mode</span>
                            <span className={`font-medium ${window.matchMedia('(display-mode: standalone)').matches ? 'text-green-600' : 'text-orange-600'}`}>
                                {window.matchMedia('(display-mode: standalone)').matches ? 'Installed App' : 'Browser Mode'}
                            </span>
                        </div>
                        {!window.matchMedia('(display-mode: standalone)').matches && (
                            <div className="pt-2 border-t">
                                <p className="text-xs text-gray-500 mb-1">Installation:</p>
                                <p className="text-xs">
                                    If the "Install App" banner is not visible at the top,
                                    tap your browser menu <span className="font-bold">(⋮)</span> and select <span className="font-bold">"Add to Home Screen"</span> or <span className="font-bold">"Install App"</span>.
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Data Section */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        Data
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                    <Button variant="outline" onClick={handleBackup} className="w-full justify-start">
                        Export Backup (JSON)
                    </Button>
                    <Button variant="outline" onClick={handleRestore} className="w-full justify-start">
                        Restore from Backup
                    </Button>
                    <p className="text-xs text-slate-500 mt-2">
                        Google Drive Sync can be implemented by uploading the exported JSON manually for now.
                    </p>
                </CardContent>
            </Card>
        </div >
    );
};

const GoogleDriveManager = ({ profiles }: { profiles?: Profile[] }) => {
    // Real Google Auth
    const [googleUser, setGoogleUser] = useState<{ email: string; name: string, picture?: string } | null>(null);
    const [showSignInModal, setShowSignInModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            const savedUser = localStorage.getItem('google_user_info');
            const accessToken = localStorage.getItem('google_access_token');

            console.log('Checking Auth State:', { savedUser: !!savedUser, accessToken: !!accessToken });

            if (savedUser) {
                try {
                    setGoogleUser(JSON.parse(savedUser));
                    console.log('Restored user from localStorage');
                    return;
                } catch (e) {
                    console.error("Failed to parse saved user info", e);
                    localStorage.removeItem('google_user_info');
                }
            }

            // Self-healing: If user info missing/bad but token exists, try to fetch it
            if (accessToken) {
                console.log('Attempting self-healing using token...');
                try {
                    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });
                    if (res.ok) {
                        const user = await res.json();
                        const userData = {
                            email: user.email,
                            name: user.name,
                            picture: user.picture
                        };
                        setGoogleUser(userData);
                        localStorage.setItem('google_user_info', JSON.stringify(userData));
                        console.log('Self-healing successful');
                    } else {
                        // Token likely expired
                        console.warn('Token invalid, clearing storage');
                        localStorage.removeItem('google_access_token');
                    }
                } catch (err) {
                    console.error("Failed to restore session from token", err);
                }
            }
        };

        checkAuth();
    }, []);

    const handleGoogleSignIn = () => {
        setIsLoading(true);
        console.log('Initiating Google Sign In...');
        try {
            const client = google.accounts.oauth2.initTokenClient({
                client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/drive.file email profile',
                callback: async (tokenResponse: any) => {
                    console.log('Token response received', tokenResponse);
                    if (tokenResponse && tokenResponse.access_token) {
                        try {
                            // Fetch User Profile
                            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                            });
                            const user = await res.json();
                            const userData = {
                                email: user.email,
                                name: user.name,
                                picture: user.picture
                            };
                            console.log('User info fetched', userData);

                            setGoogleUser(userData);

                            // Save persistence data
                            localStorage.setItem('google_access_token', tokenResponse.access_token);
                            localStorage.setItem('google_user_info', JSON.stringify(userData));
                            console.log('Detailed saved to localStorage');

                            setShowSignInModal(false);
                        } catch (err) {
                            console.error('Error fetching user info', err);
                            alert('Failed to get user profile');
                        }
                    }
                    setIsLoading(false);
                },
                error_callback: (err: any) => {
                    console.error('Auth Error', err);
                    alert('Google Sign In Failed. Check console.');
                    setIsLoading(false);
                }
            });
            client.requestAccessToken();
        } catch (err) {
            console.error(err);
            alert('Google Sign In configuration missing or invalid origin');
            setIsLoading(false);
        }
    };

    const handleLinkProfile = async (profileId: number, link: boolean) => {
        if (!googleUser) return;

        if (link) {
            await db.profiles.update(profileId, { linkedGoogleEmail: googleUser.email });
        } else {
            // Only unlink if it matches current user
            await db.profiles.update(profileId, { linkedGoogleEmail: undefined });
        }
    };

    return (
        <div className="space-y-4">
            {!googleUser ? (
                <div className="text-center p-4 border rounded-lg bg-slate-50 border-dashed">
                    <p className="text-sm text-gray-500 mb-3">Sign in to sync your data to Google Drive</p>
                    <Button onClick={() => setShowSignInModal(true)} className="bg-white text-gray-700 border hover:bg-gray-50">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" className="w-4 h-4 mr-2" />
                        Sign in with Google
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-blue-50 text-blue-800 rounded-lg">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center font-bold text-xs overflow-hidden">
                                {googleUser.picture ? (
                                    <img src={googleUser.picture} referrerPolicy="no-referrer" />
                                ) : (
                                    <span>{googleUser.name?.[0]?.toUpperCase() || 'U'}</span>
                                )}
                            </div>
                            <div>
                                <div className="text-sm font-bold">{googleUser.email}</div>
                                <div className="text-xs">Connected to Drive</div>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => {
                            setGoogleUser(null);
                            localStorage.removeItem('google_access_token');
                            localStorage.removeItem('google_user_info');
                            console.log('User signed out manually');
                        }} className="text-red-500 hover:text-red-600">
                            Disconnect
                        </Button>
                    </div>

                    <div className="pt-2">
                        <h4 className="text-sm font-medium mb-2">Link Profiles to this Account</h4>
                        <div className="space-y-2">
                            {profiles?.map((profile) => {
                                const isLinkedToCurrent = profile.linkedGoogleEmail === googleUser.email;
                                const isLinkedToOther = profile.linkedGoogleEmail && !isLinkedToCurrent;

                                return (
                                    <div key={profile.id} className="flex items-center justify-between p-2 border rounded">
                                        <div className="flex items-center gap-2">
                                            {profile.logo && <img src={profile.logo} className="w-6 h-6 rounded" />}
                                            <span className="text-sm">{profile.businessName}</span>
                                        </div>

                                        {isLinkedToOther ? (
                                            <span className="text-xs text-orange-500">Linked to {profile.linkedGoogleEmail}</span>
                                        ) : (
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 accent-blue-600"
                                                checked={isLinkedToCurrent}
                                                onChange={(e) => handleLinkProfile(profile.id!, e.target.checked)}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {showSignInModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                            <h3 className="font-semibold text-gray-700">Sync Setup</h3>
                            <button onClick={() => setShowSignInModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="space-y-1 text-center">
                                <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2 text-blue-600">
                                    <Database className="w-6 h-6" />
                                </div>
                                <h2 className="text-lg font-bold">Connect Google Drive</h2>
                                <p className="text-xs text-gray-500">Securely back up your business data.</p>
                            </div>

                            <Button
                                onClick={handleGoogleSignIn}
                                disabled={isLoading}
                                className="w-full bg-white text-gray-700 border hover:bg-gray-50 py-6"
                            >
                                <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" className="w-5 h-5 mr-3" />
                                {isLoading ? 'Connecting...' : 'Continue with Google'}
                            </Button>

                            <div className="bg-blue-50 p-3 rounded-lg text-xs space-y-2 border border-blue-100">
                                <p className="font-semibold text-blue-700 flex items-center gap-1">
                                    <span className="w-4 h-4 bg-blue-600 text-white rounded-full inline-flex items-center justify-center text-[10px]">?</span>
                                    How it works
                                </p>
                                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                                    <li>Authenticate with your Google Account.</li>
                                    <li>Grant permission to access file storage.</li>
                                    <li>Select which profiles to sync.</li>
                                    <li>Automatic backups will be saved to your Drive.</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
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
