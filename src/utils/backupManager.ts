import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { db } from '../db/db';

const BACKUP_CONFIG_KEY = 'autoBackupConfig';
const LAST_BACKUP_KEY = 'lastBackupTime';

export interface AutoBackupConfig {
    enabled: boolean;
    frequency: 'hourly' | 'daily' | '2days' | 'weekly' | 'custom';
    customIntervalMinutes?: number; // Used if frequency is 'custom'
}

export const getBackupConfig = (): AutoBackupConfig => {
    const saved = localStorage.getItem(BACKUP_CONFIG_KEY);
    return saved ? JSON.parse(saved) : { enabled: false, frequency: 'daily' };
};

export const saveBackupConfig = (config: AutoBackupConfig) => {
    localStorage.setItem(BACKUP_CONFIG_KEY, JSON.stringify(config));
};

export const getLastBackupTime = (): string | null => {
    return localStorage.getItem(LAST_BACKUP_KEY);
};

export const getNextBackupTime = (): Date | null => {
    const last = getLastBackupTime();
    if (!last) return new Date(); // If never backed up, due now

    const config = getBackupConfig();
    if (!config.enabled) return null;

    const lastDate = new Date(last);
    const nextDate = new Date(lastDate);

    switch (config.frequency) {
        case 'hourly':
            nextDate.setHours(nextDate.getHours() + 1);
            break;
        case 'daily':
            nextDate.setDate(nextDate.getDate() + 1);
            break;
        case '2days':
            nextDate.setDate(nextDate.getDate() + 2);
            break;
        case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
        case 'custom':
            nextDate.setMinutes(nextDate.getMinutes() + (config.customIntervalMinutes || 60));
            break;
    }
    return nextDate;
};

export const performBackup = async (): Promise<{ success: boolean; message: string }> => {
    try {
        console.log("Starting Auto Backup...");
        const allProfiles = await db.profiles.toArray();
        const allItems = await db.items.toArray();
        const allBills = await db.bills.toArray();
        const allCategories = await db.categories.toArray();
        const allParties = await db.parties.toArray(); // Added Parties
        const allTransactions = await db.partyTransactions.toArray(); // Added Transactions

        const timestamp = new Date().toISOString();
        const timestampSafe = timestamp.replace(/[:.]/g, '-');

        const handleEntry = await db.appConfig.get('backupFolderHandle');
        const rootHandle = handleEntry?.value as FileSystemDirectoryHandle | undefined;

        let backupStatus = "Virtual Storage";

        const saveFile = async (folderName: string, data: any) => {
            const fileName = `seematti_backup_${timestampSafe}.json`;

            if (rootHandle) {
                try {
                    // Check capability
                    const perm = await (rootHandle as any).queryPermission({ mode: 'readwrite' });
                    if (perm === 'granted') {
                        const dirHandle = await rootHandle.getDirectoryHandle(folderName, { create: true });
                        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                        // @ts-ignore
                        const writable = await fileHandle.createWritable();
                        await writable.write(JSON.stringify(data, null, 2));
                        await writable.close();
                        console.log(`Saved to Native Folder: ${folderName}/${fileName}`);
                        backupStatus = "Native Folder";
                        return;
                    } else {
                        console.warn(`Native Handle Permission state: ${perm}. Falling back.`);
                        backupStatus = "Virtual (Permission Missing)";
                    }
                } catch (nativeErr) {
                    console.error("Native FS Write Failed, attempting fallback:", nativeErr);
                    backupStatus = "Virtual (Native Error)";
                }
            }

            await Filesystem.writeFile({
                path: `Seematti_Backups/${folderName}/${fileName}`,
                data: JSON.stringify(data, null, 2),
                directory: Directory.Documents,
                encoding: Encoding.UTF8,
                recursive: true
            });
            console.log(`Saved to Seematti_Backups/${folderName}/${fileName}`);
        };

        // 1. Full Backup (Safety Net)
        /* await saveFile('Full_Backup', {
            profiles: allProfiles,
            items: allItems,
            bills: allBills,
            categories: allCategories,
            parties: allParties,
            partyTransactions: allTransactions,
            timestamp
        }); */
        // User specifically asked for separate folders with profile names.
        // Let's do exactly that.

        if (allProfiles.length === 0) {
            // Backup everything to 'Default' if no profiles exist
            await saveFile('Default', {
                items: allItems,
                bills: allBills,
                categories: allCategories,
                parties: allParties,
                partyTransactions: allTransactions,
                timestamp
            });
        }

        // 2. Per-Profile Backups
        for (const profile of allProfiles) {
            const profileData = {
                profile: profile,
                items: allItems.filter(i => i.profileId === profile.id),
                bills: allBills.filter(b => b.profileId === profile.id),
                categories: allCategories.filter(c => c.profileId === profile.id),
                parties: allParties.filter(p => p.profileId === profile.id),
                transactions: allTransactions.filter(t => t.profileId === profile.id),
                timestamp
            };
            // Sanitize folder name
            const safeName = profile.businessName.replace(/[^a-z0-9\s]/gi, '_').trim();
            await saveFile(safeName || `Profile_${profile.id}`, profileData);
        }

        // 3. Backup Unassigned Data (if any) to 'Unassigned'
        /* 
        const unassignedItems = allItems.filter(i => !i.profileId);
        if (unassignedItems.length > 0) {
             await saveFile('Unassigned', { items: unassignedItems, ... });
        } 
        */

        localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
        return { success: true, message: `Backup Successful (${backupStatus})` };

    } catch (error) {
        console.error("Auto Backup Failed:", error);
        return { success: false, message: `Failed: ${error instanceof Error ? error.message : String(error)}` };
    }
};

export const checkAndPerformBackup = async () => {
    const config = getBackupConfig();
    if (!config.enabled) return;

    const nextTime = getNextBackupTime();
    if (nextTime && new Date() >= nextTime) {
        console.log("Auto Backup is due. Executing...");
        const result = await performBackup();
        console.log("Backup Result:", result.message);
    } else {
        console.log("Auto Backup not due yet. Next:", nextTime?.toLocaleString());
    }
};
