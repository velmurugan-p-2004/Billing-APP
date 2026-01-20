import { useState } from 'react';
import { Item, Category } from '@/db/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { X, Search } from 'lucide-react';

interface CategoryItemSelectorProps {
    category: Category;
    items: Item[];
    onSelect: (item: Item) => void;
    onClose: () => void;
}

const CategoryItemSelector = ({ category, items, onSelect, onClose }: CategoryItemSelectorProps) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.variant && item.variant.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-md max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex-none flex justify-between items-center p-4 border-b">
                    <div>
                        <h2 className="text-lg font-bold">{category.name}</h2>
                        <p className="text-sm text-gray-500">SKU: {category.sku}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Search */}
                <div className="flex-none p-4 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Search items..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {filteredItems.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            {searchQuery ? 'No items found' : 'No items in this category'}
                        </div>
                    ) : (
                        filteredItems.map((item) => (
                            <Card
                                key={item.id}
                                className="p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => {
                                    if (item.stock > 0) {
                                        onSelect(item);
                                        onClose();
                                    }
                                }}
                            >
                                <div className="flex justify-between items-center">
                                    <div className="flex-1">
                                        <div className="font-medium">{item.name}</div>
                                        {item.variant && (
                                            <div className="text-xs text-gray-500">Variant: {item.variant}</div>
                                        )}
                                        <div className="text-sm mt-1">
                                            <span className="font-bold text-green-600">₹{item.price}</span>
                                            {item.mrp > item.price && (
                                                <span className="text-gray-400 line-through text-xs ml-2">₹{item.mrp}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-sm font-bold ${item.stock < 5 ? 'text-red-500' : 'text-green-600'}`}>
                                            Stock: {item.stock}
                                        </div>
                                        {item.stock === 0 && (
                                            <div className="text-xs text-red-500 mt-1">Out of Stock</div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="flex-none p-4 border-t bg-gray-50">
                    <div className="text-sm text-gray-600 text-center">
                        {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} available
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategoryItemSelector;
