// Google Drive API service for syncing bills and inventory
import { db, Bill, Item } from '@/db/db';

const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];

interface GoogleAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

class GoogleDriveService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private syncInProgress = false;
  private folderId: string | null = null;

  /**
   * Initialize Google Drive API
   */
  async initClient() {
    return new Promise((resolve, reject) => {
      gapi.load('client:auth2', async () => {
        try {
          await gapi.client.init({
            discoveryDocs: DISCOVERY_DOCS,
            clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            scope: SCOPES,
          });
          resolve(true);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Sign in with Google
   */
  async signIn(): Promise<{ email: string; name: string }> {
    try {
      await this.initClient();
      const authInstance = gapi.auth2.getAuthInstance();
      const googleUser = await authInstance.signIn();
      const profile = googleUser.getBasicProfile();
      
      this.accessToken = googleUser.getAuthResponse().access_token;
      this.tokenExpiry = Date.now() + (googleUser.getAuthResponse().expires_in * 1000);

      // Create app folder in Google Drive
      await this.getOrCreateAppFolder();

      return {
        email: profile.getEmail(),
        name: profile.getName(),
      };
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      throw error;
    }
  }

  /**
   * Sign out from Google
   */
  async signOut() {
    try {
      const authInstance = gapi.auth2.getAuthInstance();
      await authInstance.signOut();
      this.accessToken = null;
      this.folderId = null;
    } catch (error) {
      console.error('Google Sign-Out Error:', error);
      throw error;
    }
  }

  /**
   * Check if user is signed in
   */
  isSignedIn(): boolean {
    try {
      const authInstance = gapi.auth2.getAuthInstance();
      return authInstance?.isSignedIn.get() || false;
    } catch {
      return false;
    }
  }

  /**
   * Get current user email
   */
  getCurrentUserEmail(): string | null {
    try {
      const authInstance = gapi.auth2.getAuthInstance();
      const user = authInstance.currentUser.get();
      return user.getBasicProfile().getEmail();
    } catch {
      return null;
    }
  }

  /**
   * Get or create app folder in Google Drive
   */
  private async getOrCreateAppFolder(): Promise<string> {
    if (this.folderId) return this.folderId;

    try {
      // Search for existing folder
      const response = await gapi.client.drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and name='Seematti Billing Data' and trashed=false",
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.result.files && response.result.files.length > 0) {
        this.folderId = response.result.files[0].id!;
        return this.folderId;
      }

      // Create new folder
      const folderMetadata = {
        name: 'Seematti Billing Data',
        mimeType: 'application/vnd.google-apps.folder',
      };

      const folder = await gapi.client.drive.files.create({
        resource: folderMetadata,
        fields: 'id',
      });

      this.folderId = folder.result.id!;
      return this.folderId;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  /**
   * Upload or update a file in Google Drive
   */
  private async uploadFile(fileName: string, content: string, existingFileId?: string): Promise<string> {
    const folderId = await this.getOrCreateAppFolder();
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      ...(existingFileId ? {} : { parents: [folderId] }),
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      content +
      close_delim;

    const request = await fetch(
      existingFileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: existingFileId ? 'PATCH' : 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
        },
        body: multipartRequestBody,
      }
    );

    const result = await request.json();
    return result.id;
  }

  /**
   * Find file by name in app folder
   */
  private async findFile(fileName: string): Promise<string | null> {
    try {
      const folderId = await this.getOrCreateAppFolder();
      const response = await gapi.client.drive.files.list({
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.result.files && response.result.files.length > 0) {
        return response.result.files[0].id!;
      }
      return null;
    } catch (error) {
      console.error('Error finding file:', error);
      return null;
    }
  }

  /**
   * Sync bills to Google Drive
   */
  async syncBills(): Promise<void> {
    if (this.syncInProgress || !this.isSignedIn()) return;

    try {
      this.syncInProgress = true;
      const bills = await db.bills.toArray();
      const fileName = 'bills.json';
      const content = JSON.stringify(bills, null, 2);

      const existingFileId = await this.findFile(fileName);
      await this.uploadFile(fileName, content, existingFileId || undefined);

      console.log('✅ Bills synced to Google Drive');
    } catch (error) {
      console.error('❌ Error syncing bills:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync inventory to Google Drive
   */
  async syncInventory(): Promise<void> {
    if (this.syncInProgress || !this.isSignedIn()) return;

    try {
      this.syncInProgress = true;
      const items = await db.items.toArray();
      const fileName = 'inventory.json';
      const content = JSON.stringify(items, null, 2);

      const existingFileId = await this.findFile(fileName);
      await this.uploadFile(fileName, content, existingFileId || undefined);

      console.log('✅ Inventory synced to Google Drive');
    } catch (error) {
      console.error('❌ Error syncing inventory:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync both bills and inventory
   */
  async syncAll(): Promise<void> {
    if (!this.isSignedIn()) {
      throw new Error('Not signed in to Google');
    }

    await Promise.all([
      this.syncBills(),
      this.syncInventory(),
    ]);

    console.log('✅ All data synced to Google Drive');
  }

  /**
   * Download bills from Google Drive
   */
  async downloadBills(): Promise<Bill[]> {
    try {
      const fileId = await this.findFile('bills.json');
      if (!fileId) return [];

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      const bills = await response.json();
      return bills;
    } catch (error) {
      console.error('Error downloading bills:', error);
      return [];
    }
  }

  /**
   * Download inventory from Google Drive
   */
  async downloadInventory(): Promise<Item[]> {
    try {
      const fileId = await this.findFile('inventory.json');
      if (!fileId) return [];

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      const items = await response.json();
      return items;
    } catch (error) {
      console.error('Error downloading inventory:', error);
      return [];
    }
  }

  /**
   * Auto-sync on data changes
   */
  async enableAutoSync() {
    // Listen for bill changes
    db.bills.hook('creating', () => {
      setTimeout(() => this.syncBills(), 1000);
    });

    db.bills.hook('updating', () => {
      setTimeout(() => this.syncBills(), 1000);
    });

    db.bills.hook('deleting', () => {
      setTimeout(() => this.syncBills(), 1000);
    });

    // Listen for inventory changes
    db.items.hook('creating', () => {
      setTimeout(() => this.syncInventory(), 1000);
    });

    db.items.hook('updating', () => {
      setTimeout(() => this.syncInventory(), 1000);
    });

    db.items.hook('deleting', () => {
      setTimeout(() => this.syncInventory(), 1000);
    });

    console.log('✅ Auto-sync enabled');
  }
}

export const googleDriveService = new GoogleDriveService();
