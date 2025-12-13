import Dexie, { Table } from 'dexie';

export interface Item {
    id?: number;
    name: string;
    sku: string; // Barcode
    price: number; // Selling Price
    mrp: number;
    stock: number;
    lowStockLimit?: number;
    profileId?: number; // Linked Business Profile ID
}

export interface BillItem extends Item {
    quantity: number;
}

export interface Bill {
    id?: number;
    billNo: number;
    date: string; // ISO string
    customerName?: string;
    items: BillItem[];
    totalAmount: number;
    paymentMode: 'cash' | 'upi' | 'card';
    discount?: number;
    profileId?: number; // Linked Business Profile ID
}

export interface Profile {
    id?: number;
    businessName: string;
    address: string;
    phone: string;
    upiId: string;
    logo?: string; // Base64
    linkedGoogleEmail?: string; // Linked Google Account Email
}

export class BillingDB extends Dexie {
    items!: Table<Item>;
    bills!: Table<Bill>;
    profiles!: Table<Profile>;

    constructor() {
        super('SeemattiBillingDB');
        this.version(1).stores({
            items: '++id, name, sku, stock, lowStockLimit, profileId',
            bills: '++id, billNo, date, customerName, profileId',
            profiles: '++id, businessName' // No index needed for linkedGoogleEmail unless querying by it
        });
    }
}

export const db = new BillingDB();
