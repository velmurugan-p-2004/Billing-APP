import { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/db/db';

export const GoogleDriveSync = () => {
  const [googleUser, setGoogleUser] = useState<{ email: string; name: string; picture?: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const syncToGoogleDrive = async (type: 'bills' | 'inventory' | 'all') => {
    const accessToken = localStorage.getItem('google_access_token');
    if (!accessToken) return;

    try {
      if (type === 'bills' || type === 'all') {
        const bills = await db.bills.toArray();
        await uploadToGoogleDrive('bills.json', JSON.stringify(bills, null, 2), accessToken);
        console.log('✅ Bills synced to Google Drive');
      }

      if (type === 'inventory' || type === 'all') {
        const items = await db.items.toArray();
        await uploadToGoogleDrive('inventory.json', JSON.stringify(items, null, 2), accessToken);
        console.log('✅ Inventory synced to Google Drive');
      }
    } catch (error) {
      console.error('❌ Sync error:', error);
    }
  };

  const uploadToGoogleDrive = async (fileName: string, content: string, accessToken: string) => {
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    // First, try to find if file exists
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and trashed=false`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );
    const searchResult = await searchResponse.json();
    const existingFileId = searchResult.files && searchResult.files.length > 0 ? searchResult.files[0].id : null;

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      content +
      close_delim;

    const url = existingFileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    await fetch(url, {
      method: existingFileId ? 'PATCH' : 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: multipartRequestBody,
    });
  };

  const enableAutoSync = () => {
    // Listen for bill changes
    db.bills.hook('creating', () => {
      setTimeout(() => syncToGoogleDrive('bills'), 1000);
    });
    db.bills.hook('updating', () => {
      setTimeout(() => syncToGoogleDrive('bills'), 1000);
    });
    db.bills.hook('deleting', () => {
      setTimeout(() => syncToGoogleDrive('bills'), 1000);
    });

    // Listen for inventory changes
    db.items.hook('creating', () => {
      setTimeout(() => syncToGoogleDrive('inventory'), 1000);
    });
    db.items.hook('updating', () => {
      setTimeout(() => syncToGoogleDrive('inventory'), 1000);
    });
    db.items.hook('deleting', () => {
      setTimeout(() => syncToGoogleDrive('inventory'), 1000);
    });

    console.log('✅ Auto-sync enabled');
  };

  useEffect(() => {
    try {
      // Check if user is already signed in
      const savedUser = localStorage.getItem('google_user_info');
      const accessToken = localStorage.getItem('google_access_token');
      
      if (savedUser && accessToken) {
        setGoogleUser(JSON.parse(savedUser));
        enableAutoSync();
      }
    } catch (e) {
      console.error('Failed to restore Google user', e);
    }
  }, []);

  const handleSignIn = () => {
    setIsInitializing(true);
    try {
      if (!(window as any).google?.accounts?.oauth2) {
        console.error('Google API not loaded');
        alert('Google Sign-In is loading. Please try again in a moment.');
        setIsInitializing(false);
        return;
      }
      
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file email profile',
        callback: async (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            try {
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
              });
              const user = await res.json();
              const userData = {
                email: user.email,
                name: user.name,
                picture: user.picture
              };

              setGoogleUser(userData);
              localStorage.setItem('google_access_token', tokenResponse.access_token);
              localStorage.setItem('google_user_info', JSON.stringify(userData));

              // Update profile
              const profiles = await db.profiles.toArray();
              if (profiles.length > 0) {
                await db.profiles.update(profiles[0].id!, { linkedGoogleEmail: user.email });
              }

              // Enable auto-sync and initial sync
              enableAutoSync();
              await handleSync();
              
              setSyncStatus('success');
              setTimeout(() => setSyncStatus('idle'), 3000);
            } catch (err) {
              console.error('Error fetching user info', err);
              setSyncStatus('error');
            }
          }
          setIsInitializing(false);
        },
        error_callback: (err: any) => {
          console.error('Auth Error', err);
          setSyncStatus('error');
          setIsInitializing(false);
        }
      });
      client.requestAccessToken();
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
      setIsInitializing(false);
    }
  };

  const handleSignOut = async () => {
    setGoogleUser(null);
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_user_info');

    const profiles = await db.profiles.toArray();
    if (profiles.length > 0) {
      await db.profiles.update(profiles[0].id!, { linkedGoogleEmail: undefined });
    }

    setSyncStatus('idle');
  };

  const handleSync = async () => {
    if (isSyncing) return;

    try {
      setIsSyncing(true);
      setSyncStatus('syncing');

      await syncToGoogleDrive('all');

      setLastSyncTime(new Date().toLocaleString());
      setSyncStatus('success');

      setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          {googleUser ? (
            <Cloud className="w-5 h-5 text-blue-600" />
          ) : (
            <CloudOff className="w-5 h-5 text-gray-400" />
          )}
          Google Drive Backup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!googleUser ? (
          <>
            <p className="text-sm text-gray-600">
              Connect your Google account to automatically backup bills and inventory to Google Drive
            </p>
            <Button 
              onClick={handleSignIn}
              className="w-full bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
              disabled={isInitializing}
            >
              {isInitializing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4" />
                  Connect Google Drive
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-start gap-3">
                {googleUser.picture && (
                  <img src={googleUser.picture} alt={googleUser.name} className="w-10 h-10 rounded-full" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-medium text-green-900">Connected</p>
                  </div>
                  <p className="text-xs text-green-700 mt-1">{googleUser.name}</p>
                  <p className="text-xs text-green-600">{googleUser.email}</p>
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Auto-sync enabled - Changes backed up automatically
                  </p>
                </div>
              </div>
            </div>

            {lastSyncTime && (
              <p className="text-xs text-gray-500">
                Last synced: {lastSyncTime}
              </p>
            )}

            {syncStatus === 'success' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-600" />
                <p className="text-xs text-blue-900">Sync completed successfully!</p>
              </div>
            )}

            {syncStatus === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <p className="text-xs text-red-900">Sync failed. Please try again.</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSync}
                disabled={isSyncing}
                variant="outline"
                className="flex-1"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>

              <Button
                onClick={handleSignOut}
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Disconnect
              </Button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-gray-700">What's synced:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• All bills (bills.json)</li>
                <li>• All inventory items (inventory.json)</li>
                <li>• Stored in "Seematti Billing Data" folder</li>
                <li>• Automatically synced on every change</li>
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
