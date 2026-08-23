import React, { useState, useMemo } from 'react';
import { 
  X, Tag, Plus, Edit, Trash2, Check, AlertTriangle, 
  Layers, Package, CheckCircle2, ShieldCheck, Sparkles 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ProductCategory } from '../../types';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreated?: (newCategory: ProductCategory) => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  onCategoryCreated
}) => {
  const { categories, addCategory, updateCategory, deleteCategory, products } = useApp();

  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<ProductCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Count products in each category
  const productCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter(c => 
      c.name.toLowerCase().includes(q) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categories, searchQuery]);

  if (!isOpen) return null;

  const handleStartEdit = (cat: ProductCategory) => {
    setEditingCategory(cat);
    setName(cat.name);
    setCode(cat.code || '');
    setDescription(cat.description || '');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setName('');
    setCode('');
    setDescription('');
    setErrorMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg('Category name is required.');
      return;
    }

    // Check duplicate name
    const isDuplicate = categories.some(
      c => c.name.toLowerCase() === cleanName.toLowerCase() && c.id !== editingCategory?.id
    );
    if (isDuplicate) {
      setErrorMsg(`A category named "${cleanName}" already exists.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: cleanName,
          code: code.trim().toUpperCase() || undefined,
          description: description.trim() || undefined
        });
        setSuccessMsg(`Category "${cleanName}" updated successfully.`);
        setEditingCategory(null);
      } else {
        const newCat = await addCategory({
          name: cleanName,
          code: code.trim().toUpperCase() || cleanName.slice(0, 3).toUpperCase(),
          description: description.trim() || undefined,
          isDefault: false
        });
        setSuccessMsg(`Custom category "${cleanName}" created!`);
        if (onCategoryCreated) {
          onCategoryCreated(newCat);
        }
      }

      setName('');
      setCode('');
      setDescription('');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to save category. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;
    try {
      await deleteCategory(categoryToDelete.id);
      setSuccessMsg(`Category "${categoryToDelete.name}" removed.`);
      setCategoryToDelete(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to delete category.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                  Product Categories Directory
                </h2>
                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-full text-3xs font-bold">
                  {categories.length} Categories
                </span>
              </div>
              <p className="text-2xs text-slate-500">
                Create and organize custom product categories (e.g. Solar Geysers, CPVC, Bathroom Vanity) with short codes.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          
          {/* Create / Edit Category Form */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                {editingCategory ? `Edit Category: "${editingCategory.name}"` : 'Create New Custom Category'}
              </span>
              {editingCategory && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-3xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold underline"
                >
                  Cancel Edit (Create New Instead)
                </button>
              )}
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Solar Geysers & Heaters"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-hidden font-medium"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Code / Prefix
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. SLR"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Description / Included Items
                </label>
                <input
                  type="text"
                  placeholder="e.g. Solar collectors, flat plates, backup electric geysers"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {editingCategory && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
                >
                  {editingCategory ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Save Category Changes
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" /> Add Category to Catalog
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Categories Directory */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Existing Categories ({filteredCategories.length})
              </span>
              <input
                type="text"
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:border-indigo-500 outline-hidden w-full sm:w-56"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredCategories.map(cat => {
                const count = productCountByCategory[cat.name] || 0;
                const isCustom = !cat.isDefault;

                return (
                  <div 
                    key={cat.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-2 shadow-2xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                              {cat.name}
                            </span>
                            {cat.code && (
                              <span className="px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-3xs font-mono font-bold">
                                {cat.code}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-3xs font-bold whitespace-nowrap shrink-0 ${
                          isCustom 
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {isCustom ? 'Custom' : 'Default'}
                        </span>
                      </div>

                      {cat.description && (
                        <p className="text-3xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {cat.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-3xs">
                      <span className="flex items-center gap-1 text-slate-500 font-medium">
                        <Package className="w-3 h-3 text-indigo-500" />
                        <span>{count} {count === 1 ? 'product' : 'products'}</span>
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(cat)}
                          className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                          title="Edit Category"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setCategoryToDelete(cat)}
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                          title={isCustom ? 'Delete Category' : 'Remove from catalog list'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <p className="text-3xs text-slate-400">
            Categories will instantly appear in Product Registration, Filter bars, and POS counter.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-all"
          >
            Close
          </button>
        </div>

      </div>

      {/* Delete Confirmation Sub-Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 bg-black/70 z-60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="p-2 bg-rose-50 dark:bg-rose-950 rounded-lg border border-rose-200 dark:border-rose-800">
                <Trash2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Delete Category?
              </h3>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <p className="font-bold text-slate-900 dark:text-slate-100">{categoryToDelete.name}</p>
              {productCountByCategory[categoryToDelete.name] ? (
                <p className="text-3xs text-amber-600 dark:text-amber-400 mt-1 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Warning: {productCountByCategory[categoryToDelete.name]} existing products use this category.
                </p>
              ) : null}
            </div>

            <p className="text-3xs text-slate-500">
              This category will be removed from category selectors and filter lists.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-all shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
