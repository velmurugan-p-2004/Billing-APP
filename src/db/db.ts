import Dexie, { Table } from 'dexie';

export interface Category {
    id?: number;
    name: string;           // e.g., "Mens T-Shirts"
    sku: string;            // Master SKU e.g., "TSH-001"
    description?: string;
    profileId?: number;     // Linked Business Profile ID
}

export interface Item {
    id?: number;
    name: string;           // Tamil name (displayed in UI)
    englishName?: string;   // English name (used for thermal printing)
    categoryId?: number;    // Link to category (optional for backward compatibility)
    sku?: string;           // Optional individual SKU (for backward compatibility)
    price: number;          // Selling Price
    mrp: number;
    stock: number;
    trackStock?: boolean;   // Enable/disable stock tracking (default: true)
    lowStockLimit?: number;
    variant?: string;       // e.g., "Red-M", "Blue-L" (optional)
    profileId?: number;     // Linked Business Profile ID
    unit?: string;          // Unit of measurement (e.g., "kg", "pieces", "liters")
}

export interface PartyTransaction {
    id?: number;
    partyId: number;
    date: string;
    type: 'CREDIT_BILL' | 'PAYMENT' | 'CHARGE';
    amount: number;
    billId?: number; // Linked Bill ID if type is CREDIT_BILL
    description?: string;
    profileId?: number;
}

export interface BillItem extends Item {
    quantity: number;
}

export interface Party {
    id?: number;
    name: string;
    mobile: string;
    aadhar?: string;
    balance: number; // Amount owed by party (Positive = Debt)
    profileId?: number;
}

export interface Bill {
    id?: number;
    billNo: number;
    date: string; // ISO string
    customerName?: string;
    items: BillItem[];
    totalAmount: number;
    paymentMode: 'cash' | 'upi' | 'card' | 'credit';
    discount?: number;
    profileId?: number; // Linked Business Profile ID
    partyId?: number;   // Linked Party ID (if credit)
    paidAmount?: number;
}

export interface Profile {
    id?: number;
    businessName: string;
    address: string;
    phone: string;
    upiId: string;
    logo?: string; // Base64
    linkedGoogleEmail?: string; // Linked Google Account Email
    enableUnits?: boolean; // Enable unit selection for items
    units?: string[]; // Available units (e.g., ["kg", "pieces", "liters", "grams"])
    enableMRP?: boolean; // Enable MRP input in billing
    autoPriceEntry?: boolean; // Auto-focus price input when item is added to cart
    defaultDiscountType?: 'amount' | 'percentage'; // Default discount type
    defaultDiscountValue?: number; // Default discount value
}

export class BillingDB extends Dexie {
    items!: Table<Item>;
    bills!: Table<Bill>;
    profiles!: Table<Profile>;
    categories!: Table<Category>;
    parties!: Table<Party>;
    partyTransactions!: Table<PartyTransaction>;
    appConfig!: Table<{ key: string; value: any }>;

    constructor() {
        super('SeemattiBillingDB');

        // Version 1 - Original schema
        this.version(1).stores({
            items: '++id, name, sku, stock, lowStockLimit, profileId',
            bills: '++id, billNo, date, customerName, profileId',
            profiles: '++id, businessName'
        });

        // Version 2 - Add categories and update items
        this.version(2).stores({
            items: '++id, name, sku, categoryId, stock, lowStockLimit, profileId',
            bills: '++id, billNo, date, customerName, profileId',
            profiles: '++id, businessName',
            categories: '++id, name, sku, profileId'
        }).upgrade(async tx => {
            // Create default "Uncategorized" category
            const uncategorizedId = await tx.table('categories').add({
                name: 'Uncategorized',
                sku: 'UNCAT-001',
                description: 'Default category for existing items'
            });

            // Update all existing items to link to Uncategorized category
            const items = await tx.table('items').toArray();
            for (const item of items) {
                await tx.table('items').update(item.id!, {
                    categoryId: uncategorizedId
                });
            }
        });

        // Version 3 - Add Parties
        this.version(3).stores({
            items: '++id, name, sku, categoryId, stock, lowStockLimit, profileId',
            bills: '++id, billNo, date, customerName, profileId, partyId',
            profiles: '++id, businessName',
            categories: '++id, name, sku, profileId',
            parties: '++id, name, mobile, profileId'
        });

        // Version 4 - Add Party Transactions
        this.version(4).stores({
            items: '++id, name, sku, categoryId, stock, lowStockLimit, profileId',
            bills: '++id, billNo, date, customerName, profileId, partyId',
            profiles: '++id, businessName',
            categories: '++id, name, sku, profileId',
            parties: '++id, name, mobile, profileId',
            partyTransactions: '++id, partyId, date, type, billId, profileId'
        });

        // Version 5 - Add App Config (for Directory Handles etc)
        this.version(5).stores({
            items: '++id, name, sku, categoryId, stock, lowStockLimit, profileId',
            bills: '++id, billNo, date, customerName, profileId, partyId',
            profiles: '++id, businessName',
            categories: '++id, name, sku, profileId',
            parties: '++id, name, mobile, profileId',
            partyTransactions: '++id, partyId, date, type, billId, profileId',
            appConfig: 'key'
        });

        // Version 6 - Add englishName to items for thermal printing
        this.version(6).stores({
            items: '++id, name, englishName, sku, categoryId, stock, lowStockLimit, profileId',
            bills: '++id, billNo, date, customerName, profileId, partyId',
            profiles: '++id, businessName',
            categories: '++id, name, sku, profileId',
            parties: '++id, name, mobile, profileId',
            partyTransactions: '++id, partyId, date, type, billId, profileId',
            appConfig: 'key'
        });
    }
}

export const db = new BillingDB();
