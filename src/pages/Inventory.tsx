import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { db, Item } from '@/db/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, ScanLine, X, Edit, Trash2 } from 'lucide-react';
import Scanner from '@/components/Scanner';

const Inventory = () => {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const [formData, setFormData] = useState<Partial<Item>>({
        name: '',
        sku: '',
        price: undefined,
        mrp: undefined,
        stock: undefined,
        lowStockLimit: undefined,
        profileId: Number(localStorage.getItem('defaultProfileId')) || undefined
    });

    const profiles = useLiveQuery(() => db.profiles.toArray());


    const items = useLiveQuery(
        () => {
            if (!searchQuery) return db.items.toArray();
            return db.items
                .filter(item =>
                    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.sku.includes(searchQuery)
                )
                .toArray();
        },
        [searchQuery]
    );

    const handleScan = (code: string) => {
        setFormData(prev => ({ ...prev, sku: code }));
        setIsScanning(false);
    };

    const handleSave = async () => {
        // Validate required fields
        if (!formData.name || !formData.name.trim()) {
            alert('Please enter item name');
            return;
        }

        if (!formData.price || Number(formData.price) <= 0) {
            alert('Please enter a valid price');
            return;
        }

        try {
            if (editingId) {
                await db.items.update(editingId, changeNumericFields(formData));
            } else {
                await db.items.add(changeNumericFields(formData) as Item);
            }

            resetForm();
        } catch (error) {
            console.error('Error saving item:', error);
            alert('Failed to save item. Please try again.');
        }
    };

    const changeNumericFields = (data: Partial<Item>) => ({
        ...data,
        price: Number(data.price) || 0,
        mrp: Number(data.mrp) || 0,
        stock: Number(data.stock) || 0,
        lowStockLimit: Number(data.lowStockLimit) || 0,
        profileId: Number(data.profileId) || undefined
    });

    const handleDelete = (id?: number) => {
        if (id && confirm('Delete this item?')) {
            db.items.delete(id);
        }
    };

    const handleEdit = (item: Item) => {
        setFormData(item);
        setEditingId(item.id || null);
        setIsAdding(true);
    };

    const resetForm = () => {
        setFormData({
            name: '', sku: '', price: undefined, mrp: undefined, stock: undefined, lowStockLimit: undefined,
            profileId: Number(localStorage.getItem('defaultProfileId')) || undefined
        });
        setEditingId(null);
        setIsAdding(false);
    };

    return (
        <div className="p-4 pb-24 max-w-md mx-auto relative min-h-screen">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">{t('inventory')}</h1>
                <Button size="sm" onClick={() => setIsAdding(true)}>
                    <Plus className="w-4 h-4 mr-1" /> {t('add_item')}
                </Button>
            </div>

            <div className="relative mb-4">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                    placeholder="Search items..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="space-y-2">
                {items?.map((item) => (
                    <Card key={item.id} className="overflow-hidden">
                        <CardContent className="p-3 flex justify-between items-center">
                            <div>
                                <div className="font-semibold">{item.name}</div>
                                <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                                <div className="text-sm mt-1">
                                    ₹{item.price} <span className="text-gray-400 line-through text-xs">₹{item.mrp}</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <div className={`text-sm font-bold ${item.stock < 5 ? 'text-red-500' : 'text-green-600'}`}>
                                    Stk: {item.stock}
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(item.id)}>
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {items?.length === 0 && (
                    <div className="text-center py-8 text-gray-500">No items found</div>
                )}
            </div>

            {/* Add/Edit Overlay */}
            {isAdding && (
                <div className="fixed inset-0 z-50 bg-white flex flex-col h-[100dvh]">
                    <div className="flex-none flex justify-between items-center p-4 border-b">
                        <h2 className="text-xl font-bold">{editingId ? 'Edit Item' : t('add_item')}</h2>
                        <Button variant="ghost" size="icon" onClick={resetForm}>
                            <X className="w-6 h-6" />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div>
                            <label className="text-sm font-medium">Business Profile</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.profileId || ''}
                                onChange={e => setFormData({ ...formData, profileId: Number(e.target.value) })}
                            >
                                <option value="">Select Business</option>
                                {profiles?.map(p => (
                                    <option key={p.id} value={p.id}>{p.businessName}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">{t('name')}</label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Barcode / SKU</label>
                            <div className="flex gap-2">
                                <Input
                                    value={formData.sku}
                                    onChange={e => setFormData({ ...formData, sku: e.target.value })}
                                />
                                <Button variant="outline" size="icon" onClick={() => setIsScanning(true)}>
                                    <ScanLine className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Selling Price</label>
                                <Input
                                    type="number"
                                    value={formData.price ?? ''}
                                    onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">MRP</label>
                                <Input
                                    type="number"
                                    value={formData.mrp ?? ''}
                                    onChange={e => setFormData({ ...formData, mrp: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium">{t('stock')}</label>
                            <Input
                                type="number"
                                value={formData.stock ?? ''}
                                onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Low Stock Alert Limit</label>
                            <Input
                                type="number"
                                placeholder="e.g. 5"
                                value={formData.lowStockLimit ?? ''}
                                onChange={e => setFormData({ ...formData, lowStockLimit: Number(e.target.value) })}
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pb-6">
                            <Button variant="outline" onClick={resetForm}>
                                Cancel
                            </Button>
                            <Button
                                className="bg-slate-900 text-white hover:bg-slate-800"
                                onClick={handleSave}
                            >
                                {t('save')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {isScanning && (
                <Scanner onScan={handleScan} onClose={() => setIsScanning(false)} />
            )}
        </div>
    );
};

export default Inventory;
