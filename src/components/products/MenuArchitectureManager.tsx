import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  X, Plus, Edit2, Trash2, ArrowLeft, Upload, Check, 
  ChefHat, Layers, Sparkles, AlertTriangle, 
  Search, SlidersHorizontal, Package, Tag, 
  FolderTree, Flame, ChevronRight, CheckCircle2, RotateCcw,
  RefreshCw, Boxes, Wine, Download, FileSpreadsheet, FileText, FileUp, Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, RecipeIngredient } from '../../types';
import { formatNPR } from '../../utils/nepalFormatters';
import { generateUniqueSKU, generateUniqueBarcode } from '../../utils/codeGenerator';
import { Button } from '../common/Button';

// Preset Palette Colors for Menu Tiles
const TILE_COLORS = [
  { id: 'blue', name: 'Royal Indigo', hex: '#2563eb' },
  { id: 'amber', name: 'Warm Amber', hex: '#d97706' },
  { id: 'emerald', name: 'Fresh Green', hex: '#059669' },
  { id: 'rose', name: 'Chilly Red', hex: '#e11d48' },
  { id: 'sky', name: 'Cool Cyan', hex: '#0284c7' },
  { id: 'purple', name: 'Plum Violet', hex: '#7c3aed' },
  { id: 'brown', name: 'Coffee Brown', hex: '#78350f' },
  { id: 'slate', name: 'Charcoal Slate', hex: '#334155' }
];

// Default Hierarchy Structure
interface HierarchyConfig {
  departments: string[];
  categories: Record<string, string[]>; // dept -> categories
  subCategories: Record<string, string[]>; // category -> subCategories
  prepStyles: Record<string, string[]>; // category -> prepStyles
  categoryColors: Record<string, string>;
}

const DEFAULT_HIERARCHY: HierarchyConfig = {
  departments: ['Food', 'Drink', 'Combos'],
  categories: {
    Food: [],
    Drink: [],
    Combos: []
  },
  subCategories: {},
  prepStyles: {},
  categoryColors: {}
};

const HIERARCHY_STORAGE_KEY = 'quickims_menu_hierarchy_v5';

interface MenuArchitectureManagerProps {
  onClose?: () => void;
  isModal?: boolean;
}

export const MenuArchitectureManager: React.FC<MenuArchitectureManagerProps> = ({ 
  onClose,
  isModal = false
}) => {
  const { products, addProduct, updateProduct, deleteProduct } = useApp();

  // Active view: 'browse' (3-Pane catalog & recipe editor) or 'master' (Manage all 4 levels)
  const [activeTab, setActiveTab] = useState<'browse' | 'master' | 'bulk'>('browse');

  // Load and persist hierarchy configuration
  const [hierarchy, setHierarchy] = useState<HierarchyConfig>(() => {
    try {
      // Clear legacy storage keys from previous iterations
      localStorage.removeItem('quickims_menu_hierarchy_v2');
      localStorage.removeItem('quickims_menu_hierarchy_v3');
      localStorage.removeItem('quickims_menu_hierarchy_v4');
      const cached = localStorage.getItem(HIERARCHY_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.departments && parsed.categories && parsed.subCategories && parsed.prepStyles) {
          // Filter out any default presets if lingering in cache
          const unwanted = ['starter', 'appetizer', 'main course', 'soup', 'salad', 'momo', 'burger', 'chowmein', 'pizza', 'sizzler', 'sides & snacks', 'desserts', 'beverages'];
          const cleanCategories: Record<string, string[]> = {};
          Object.keys(parsed.categories).forEach(dept => {
            cleanCategories[dept] = (parsed.categories[dept] || []).filter((c: string) => !unwanted.some(u => c.toLowerCase().includes(u)));
          });
          return {
            ...parsed,
            categories: cleanCategories
          };
        }
      }
    } catch (e) {
      console.error('Failed to load menu hierarchy', e);
    }
    return DEFAULT_HIERARCHY;
  });

  useEffect(() => {
    localStorage.setItem(HIERARCHY_STORAGE_KEY, JSON.stringify(hierarchy));
  }, [hierarchy]);

  // Selected State in Browser
  const [selectedDept, setSelectedDept] = useState<string>('Food');
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [selectedSubCatFilter, setSelectedSubCatFilter] = useState<string>('ALL');
  const [selectedPrepStyleFilter, setSelectedPrepStyleFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Modal states for managing levels
  const [manageModal, setManageModal] = useState<{
    open: boolean;
    type: 'dept' | 'cat' | 'subCat' | 'prepStyle';
    mode: 'create' | 'edit';
    targetName?: string;
    parentCategory?: string;
    parentDept?: string;
    initialValue?: string;
    initialColor?: string;
  }>({
    open: false,
    type: 'dept',
    mode: 'create'
  });

  const [modalInputValue, setModalInputValue] = useState('');
  const [modalColorValue, setModalColorValue] = useState(TILE_COLORS[0].hex);

  // Bulk Upload State
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkCsvMode, setBulkCsvMode] = useState<'upload' | 'paste'>('upload');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<string | null>(null);
  const [csvFeedback, setCsvFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editing Item state (Right Inspector)
  const [editingItem, setEditingItem] = useState<{
    id?: string;
    name: string;
    price: number;
    department: string;
    category: string;
    subCategory: string;
    prepStyle: string;
    tileColor: string;
    customAddons: { name: string; price: number }[];
    recipeIngredients: RecipeIngredient[];
    orderRoutingStation?: 'kitchen' | 'bar';
    trackStock: boolean;
    currentStock: number;
    reorderLevel: number;
  }>({
    name: '',
    price: 0,
    department: 'Food',
    category: '',
    subCategory: '',
    prepStyle: '',
    tileColor: '#2563eb',
    orderRoutingStation: 'kitchen',
    customAddons: [],
    recipeIngredients: [],
    trackStock: true,
    currentStock: 0,
    reorderLevel: 0
  });

  const [tempAddonName, setTempAddonName] = useState('');
  const [tempAddonPrice, setTempAddonPrice] = useState<number>(30);

  // Form feedback & loading states
  const itemNameInputRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSavingItem, setIsSavingItem] = useState(false);

  // Ensure selectedDept is valid
  useEffect(() => {
    if (!hierarchy.departments.includes(selectedDept)) {
      setSelectedDept(hierarchy.departments[0] || 'Food');
    }
  }, [hierarchy.departments, selectedDept]);

  // Categories in selected Department
  const categoriesInDept = useMemo(() => {
    if (!selectedDept) return [];
    return hierarchy.categories[selectedDept] || [];
  }, [hierarchy.categories, selectedDept]);

  // Ensure selectedCat is valid
  useEffect(() => {
    if (categoriesInDept.length > 0) {
      if (!selectedCat || !categoriesInDept.includes(selectedCat)) {
        setSelectedCat(categoriesInDept[0]);
      }
    } else {
      setSelectedCat('');
    }
  }, [categoriesInDept, selectedCat]);

  // SubCategories in selected Category
  const subCategoriesInCat = useMemo(() => {
    if (!selectedCat) return [];
    return hierarchy.subCategories[selectedCat] || [];
  }, [hierarchy.subCategories, selectedCat]);

  // PrepStyles in selected Category
  const prepStylesInCat = useMemo(() => {
    if (!selectedCat) return [];
    return hierarchy.prepStyles[selectedCat] || [];
  }, [hierarchy.prepStyles, selectedCat]);

  // Active products (excluding discontinued)
  const activeProducts = useMemo(() => {
    return products.filter(p => p.status !== 'discontinued');
  }, [products]);

  // Actual raw ingredients from inventory for BOM mapping
  const rawIngredients = useMemo(() => {
    return products.filter(p => p.itemType === 'raw_ingredient' || (!p.itemType && (p.category || '').toLowerCase().includes('raw')));
  }, [products]);

  // Group raw pantry ingredients by category for basis-of-category selection
  const rawIngredientCategories = useMemo(() => {
    const set = new Set<string>();
    rawIngredients.forEach(r => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [rawIngredients]);

  // Items matching current Department & Category & Search (Sub & Prep filters removed from middle column)
  const filteredItems = useMemo(() => {
    return activeProducts.filter(p => {
      const pDept = p.department || (p.category === 'Alcohol' || p.category === 'Cold' || p.category === 'Hot' ? 'Drink' : 'Food');
      const pCat = p.category;

      if (pDept !== selectedDept) return false;
      if (pCat !== selectedCat) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(query);
        const matchSku = p.sku.toLowerCase().includes(query);
        const matchSub = (p.subCategory || '').toLowerCase().includes(query);
        const matchPrep = (p.prepStyle || '').toLowerCase().includes(query);
        if (!matchName && !matchSku && !matchSub && !matchPrep) return false;
      }

      return true;
    });
  }, [activeProducts, selectedDept, selectedCat, searchQuery]);

  // Select item into inspector
  const handleSelectItem = (prod: Product) => {
    setFormError(null);
    setFormSuccess(null);
    setSelectedProductId(prod.id);
    setEditingItem({
      id: prod.id,
      name: prod.name,
      price: prod.retailPrice,
      department: prod.department || selectedDept,
      category: prod.category || selectedCat,
      subCategory: prod.subCategory || (subCategoriesInCat[0] || 'General'),
      prepStyle: prod.prepStyle || (prepStylesInCat[0] || 'Standard'),
      tileColor: prod.tileColor || hierarchy.categoryColors[prod.category] || '#2563eb',
      customAddons: prod.customAddons ? [...prod.customAddons] : [],
      recipeIngredients: prod.recipeIngredients ? [...prod.recipeIngredients] : [],
      orderRoutingStation: prod.orderRoutingStation || ((prod.department === 'Drink' || prod.itemType === 'beverage') ? 'bar' : 'kitchen'),
      trackStock: prod.trackStock ?? true,
      currentStock: prod.currentStock ?? 50,
      reorderLevel: prod.reorderLevel ?? 10
    });
  };

  // Start new item in current Category
  const handleStartNewItem = () => {
    setFormError(null);
    setFormSuccess(null);
    setSelectedProductId('new');
    setEditingItem({
      name: '',
      price: 0,
      department: selectedDept || (hierarchy.departments[0] || 'Food'),
      category: selectedCat || (categoriesInDept[0] || ''),
      subCategory: subCategoriesInCat[0] || '',
      prepStyle: prepStylesInCat[0] || '',
      tileColor: (selectedCat && hierarchy.categoryColors[selectedCat]) || '#2563eb',
      orderRoutingStation: (selectedDept === 'Drink' ? 'bar' : 'kitchen'),
      customAddons: [],
      recipeIngredients: [],
      trackStock: true,
      currentStock: 0,
      reorderLevel: 0
    });
    setTimeout(() => {
      itemNameInputRef.current?.focus();
    }, 50);
  };

  // Auto-select first item when branch changes
  useEffect(() => {
    if (!selectedProductId && filteredItems.length > 0) {
      handleSelectItem(filteredItems[0]);
    } else if (filteredItems.length === 0 && selectedProductId !== 'new') {
      handleStartNewItem();
    }
  }, [selectedDept, selectedCat, filteredItems.length]);

  // ===================== CRUD FOR HIERARCHY LEVELS =====================
  const openCreateModal = (type: 'dept' | 'cat' | 'subCat' | 'prepStyle') => {
    setManageModal({
      open: true,
      type,
      mode: 'create',
      parentDept: selectedDept,
      parentCategory: selectedCat
    });
    setModalInputValue('');
    setModalColorValue(TILE_COLORS[0].hex);
  };

  const openEditModal = (type: 'dept' | 'cat' | 'subCat' | 'prepStyle', targetName: string) => {
    setManageModal({
      open: true,
      type,
      mode: 'edit',
      targetName,
      parentDept: selectedDept,
      parentCategory: selectedCat,
      initialValue: targetName,
      initialColor: type === 'cat' ? hierarchy.categoryColors[targetName] || '#2563eb' : undefined
    });
    setModalInputValue(targetName);
    if (type === 'cat') {
      setModalColorValue(hierarchy.categoryColors[targetName] || '#2563eb');
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = modalInputValue.trim();
    if (!cleanName) return;

    const { type, mode, targetName, parentDept = selectedDept, parentCategory = selectedCat } = manageModal;

    if (type === 'dept') {
      if (mode === 'create') {
        if (!hierarchy.departments.includes(cleanName)) {
          setHierarchy(prev => ({
            ...prev,
            departments: [...prev.departments, cleanName],
            categories: { ...prev.categories, [cleanName]: [] }
          }));
          setSelectedDept(cleanName);
        }
      } else if (mode === 'edit' && targetName) {
        // Rename department across hierarchy and products
        setHierarchy(prev => {
          const updatedDepts = prev.departments.map(d => d === targetName ? cleanName : d);
          const updatedCats = { ...prev.categories };
          if (updatedCats[targetName]) {
            updatedCats[cleanName] = updatedCats[targetName];
            delete updatedCats[targetName];
          }
          return { ...prev, departments: updatedDepts, categories: updatedCats };
        });

        // Update matching products
        const toUpdate = activeProducts.filter(p => p.department === targetName);
        for (const p of toUpdate) {
          await updateProduct(p.id, { department: cleanName });
        }

        if (selectedDept === targetName) setSelectedDept(cleanName);
      }
    } else if (type === 'cat') {
      if (mode === 'create') {
        setHierarchy(prev => {
          const currentList = prev.categories[parentDept] || [];
          return {
            ...prev,
            categories: {
              ...prev.categories,
              [parentDept]: currentList.includes(cleanName) ? currentList : [...currentList, cleanName]
            },
            subCategories: { ...prev.subCategories, [cleanName]: prev.subCategories[cleanName] || ['General'] },
            prepStyles: { ...prev.prepStyles, [cleanName]: prev.prepStyles[cleanName] || ['Standard'] },
            categoryColors: { ...prev.categoryColors, [cleanName]: modalColorValue }
          };
        });
        setSelectedCat(cleanName);
      } else if (mode === 'edit' && targetName) {
        // Rename category
        setHierarchy(prev => {
          const currentList = prev.categories[parentDept] || [];
          const updatedList = currentList.map(c => c === targetName ? cleanName : c);
          const updatedSubs = { ...prev.subCategories };
          const updatedPreps = { ...prev.prepStyles };
          const updatedColors = { ...prev.categoryColors };

          if (updatedSubs[targetName]) {
            updatedSubs[cleanName] = updatedSubs[targetName];
            delete updatedSubs[targetName];
          }
          if (updatedPreps[targetName]) {
            updatedPreps[cleanName] = updatedPreps[targetName];
            delete updatedPreps[targetName];
          }
          updatedColors[cleanName] = modalColorValue;
          if (targetName !== cleanName) delete updatedColors[targetName];

          return {
            ...prev,
            categories: { ...prev.categories, [parentDept]: updatedList },
            subCategories: updatedSubs,
            prepStyles: updatedPreps,
            categoryColors: updatedColors
          };
        });

        // Update matching products
        const toUpdate = activeProducts.filter(p => p.category === targetName);
        for (const p of toUpdate) {
          await updateProduct(p.id, { category: cleanName, tileColor: modalColorValue });
        }

        if (selectedCat === targetName) setSelectedCat(cleanName);
      }
    } else if (type === 'subCat') {
      if (mode === 'create') {
        setHierarchy(prev => {
          const currentList = prev.subCategories[parentCategory] || [];
          return {
            ...prev,
            subCategories: {
              ...prev.subCategories,
              [parentCategory]: currentList.includes(cleanName) ? currentList : [...currentList, cleanName]
            }
          };
        });
        setEditingItem(prev => ({ ...prev, subCategory: cleanName }));
      } else if (mode === 'edit' && targetName) {
        // Rename subcategory
        setHierarchy(prev => {
          const currentList = prev.subCategories[parentCategory] || [];
          return {
            ...prev,
            subCategories: {
              ...prev.subCategories,
              [parentCategory]: currentList.map(s => s === targetName ? cleanName : s)
            }
          };
        });

        const toUpdate = activeProducts.filter(p => p.category === parentCategory && p.subCategory === targetName);
        for (const p of toUpdate) {
          await updateProduct(p.id, { subCategory: cleanName });
        }

        if (selectedSubCatFilter === targetName) setSelectedSubCatFilter(cleanName);
        if (editingItem.subCategory === targetName) setEditingItem(prev => ({ ...prev, subCategory: cleanName }));
      }
    } else if (type === 'prepStyle') {
      if (mode === 'create') {
        setHierarchy(prev => {
          const currentList = prev.prepStyles[parentCategory] || [];
          return {
            ...prev,
            prepStyles: {
              ...prev.prepStyles,
              [parentCategory]: currentList.includes(cleanName) ? currentList : [...currentList, cleanName]
            }
          };
        });
        setEditingItem(prev => ({ ...prev, prepStyle: cleanName }));
      } else if (mode === 'edit' && targetName) {
        // Rename prep style
        setHierarchy(prev => {
          const currentList = prev.prepStyles[parentCategory] || [];
          return {
            ...prev,
            prepStyles: {
              ...prev.prepStyles,
              [parentCategory]: currentList.map(s => s === targetName ? cleanName : s)
            }
          };
        });

        const toUpdate = activeProducts.filter(p => p.category === parentCategory && p.prepStyle === targetName);
        for (const p of toUpdate) {
          await updateProduct(p.id, { prepStyle: cleanName });
        }

        if (selectedPrepStyleFilter === targetName) setSelectedPrepStyleFilter(cleanName);
        if (editingItem.prepStyle === targetName) setEditingItem(prev => ({ ...prev, prepStyle: cleanName }));
      }
    }

    setManageModal({ open: false, type: 'dept', mode: 'create' });
  };

  const handleDeleteLevel = async (type: 'dept' | 'cat' | 'subCat' | 'prepStyle', targetName: string) => {
    if (!confirm(`Are you sure you want to delete ${type.toUpperCase()}: "${targetName}"?`)) return;

    if (type === 'dept') {
      if (hierarchy.departments.length <= 1) {
        alert('You must retain at least one root department.');
        return;
      }
      setHierarchy(prev => ({
        ...prev,
        departments: prev.departments.filter(d => d !== targetName)
      }));
      if (selectedDept === targetName) {
        setSelectedDept(hierarchy.departments.find(d => d !== targetName) || 'Food');
      }
    } else if (type === 'cat') {
      setHierarchy(prev => ({
        ...prev,
        categories: {
          ...prev.categories,
          [selectedDept]: (prev.categories[selectedDept] || []).filter(c => c !== targetName)
        }
      }));
      if (selectedCat === targetName) {
        const remaining = (hierarchy.categories[selectedDept] || []).filter(c => c !== targetName);
        if (remaining.length > 0) setSelectedCat(remaining[0]);
      }
    } else if (type === 'subCat') {
      setHierarchy(prev => ({
        ...prev,
        subCategories: {
          ...prev.subCategories,
          [selectedCat]: (prev.subCategories[selectedCat] || []).filter(s => s !== targetName)
        }
      }));
      if (selectedSubCatFilter === targetName) setSelectedSubCatFilter('ALL');
    } else if (type === 'prepStyle') {
      setHierarchy(prev => ({
        ...prev,
        prepStyles: {
          ...prev.prepStyles,
          [selectedCat]: (prev.prepStyles[selectedCat] || []).filter(p => p !== targetName)
        }
      }));
      if (selectedPrepStyleFilter === targetName) setSelectedPrepStyleFilter('ALL');
    }
  };

  // ===================== RECIPE INGREDIENT HANDLERS =====================
  // Fix: Button always works! Appends a fresh row with default values.
  const handleAddRecipeIngredient = () => {
    const newIng: RecipeIngredient = {
      ingredientId: '',
      ingredientName: '',
      quantityRequired: 0,
      unit: 'kg',
      costPerUnit: 0,
      totalCost: 0
    };

    setEditingItem(prev => ({
      ...prev,
      recipeIngredients: [...prev.recipeIngredients, newIng]
    }));
  };

  const handleUpdateRecipeIngredient = (index: number, updates: Partial<RecipeIngredient>) => {
    setEditingItem(prev => {
      const updated = [...prev.recipeIngredients];
      const current = updated[index];
      const merged = { ...current, ...updates };

      // Recalculate total cost for line
      const qty = typeof merged.quantityRequired === 'number' ? merged.quantityRequired : 0;
      const unitCost = typeof merged.costPerUnit === 'number' ? merged.costPerUnit : 0;
      merged.totalCost = Math.round(qty * unitCost * 10) / 10;

      updated[index] = merged;
      return { ...prev, recipeIngredients: updated };
    });
  };

  const handleRemoveRecipeIngredient = (index: number) => {
    setEditingItem(prev => ({
      ...prev,
      recipeIngredients: prev.recipeIngredients.filter((_, i) => i !== index)
    }));
  };

  // Total BOM Cost & Food Cost %
  const totalBOMCost = useMemo(() => {
    return editingItem.recipeIngredients.reduce((sum, ing) => sum + (ing.totalCost || 0), 0);
  }, [editingItem.recipeIngredients]);

  const foodCostPercent = useMemo(() => {
    return (editingItem.price > 0 && totalBOMCost > 0) ? Math.round((totalBOMCost / editingItem.price) * 100) : 0;
  }, [totalBOMCost, editingItem.price]);

  // ===================== CUSTOM ADDONS HANDLERS =====================
  const handleAddAddon = () => {
    if (!tempAddonName.trim()) return;
    setEditingItem(prev => ({
      ...prev,
      customAddons: [...prev.customAddons, { name: tempAddonName.trim(), price: tempAddonPrice }]
    }));
    setTempAddonName('');
    setTempAddonPrice(30);
  };

  const handleRemoveAddon = (index: number) => {
    setEditingItem(prev => ({
      ...prev,
      customAddons: prev.customAddons.filter((_, i) => i !== index)
    }));
  };

  // ===================== PRODUCT ITEM CRUD =====================
  const handleSaveItem = async () => {
    setFormError(null);
    setFormSuccess(null);

    const trimmedName = editingItem.name.trim();
    if (!trimmedName) {
      setFormError('Please enter an item display name before saving.');
      itemNameInputRef.current?.focus();
      return;
    }

    if (editingItem.price < 0 || isNaN(editingItem.price)) {
      setFormError('Selling price must be a valid positive number.');
      return;
    }

    setIsSavingItem(true);

    try {
      if (editingItem.id) {
        // Update existing item
        await updateProduct(editingItem.id, {
          name: trimmedName,
          retailPrice: editingItem.price,
          costPrice: totalBOMCost > 0 ? totalBOMCost : 0,
          department: editingItem.department,
          category: editingItem.category,
          subCategory: editingItem.subCategory,
          prepStyle: editingItem.prepStyle,
          tileColor: editingItem.tileColor,
          orderRoutingStation: editingItem.orderRoutingStation || (editingItem.department === 'Drink' ? 'bar' : 'kitchen'),
          customAddons: editingItem.customAddons,
          recipeIngredients: editingItem.recipeIngredients,
          currentStock: editingItem.currentStock,
          reorderLevel: editingItem.reorderLevel,
          trackStock: editingItem.trackStock
        });
        setFormSuccess(`✓ Changes to "${trimmedName}" saved successfully!`);
      } else {
        // Create new item
        const targetDept = editingItem.department || selectedDept || (hierarchy.departments[0] || 'Food');
        const targetCat = editingItem.category || selectedCat || (hierarchy.categories[targetDept]?.[0] || '');
        if (!targetCat) {
          setFormError('Please create and select a Category first to organize this item.');
          setIsSavingItem(false);
          return;
        }
        const routing = editingItem.orderRoutingStation || (targetDept === 'Drink' ? 'bar' : 'kitchen');
        const newSku = generateUniqueSKU(targetCat || 'MENU', 'In-House Kitchen', activeProducts);
        const newBarcode = generateUniqueBarcode(activeProducts);
        const created = await addProduct({
          sku: newSku,
          barcode: newBarcode,
          name: trimmedName,
          retailPrice: editingItem.price,
          costPrice: totalBOMCost > 0 ? totalBOMCost : 0,
          wholesalePrice: editingItem.price,
          department: targetDept,
          category: targetCat,
          subCategory: editingItem.subCategory || 'General',
          prepStyle: editingItem.prepStyle || 'Standard',
          tileColor: editingItem.tileColor || hierarchy.categoryColors[targetCat] || '#2563eb',
          orderRoutingStation: routing,
          customAddons: editingItem.customAddons || [],
          recipeIngredients: editingItem.recipeIngredients || [],
          brand: 'In-House Kitchen',
          baseUnit: targetDept === 'Drink' ? 'Bottle/Glass' : 'Portion',
          baseUnitSymbol: targetDept === 'Drink' ? 'btl' : 'portion',
          alternativeUnits: [],
          taxRatePercent: 13,
          trackStock: editingItem.trackStock,
          currentStock: editingItem.currentStock,
          reorderLevel: editingItem.reorderLevel,
          warehouseId: 'wh-main',
          warehouseName: 'Main Kitchen Prep',
          hasVariants: false,
          itemType: targetDept === 'Drink' ? 'beverage' : 'menu_item',
          status: 'active'
        });

        // Set the newly created product as selected and sync inspector state with its new ID!
        setSelectedProductId(created.id);
        setEditingItem({
          id: created.id,
          name: created.name,
          price: created.retailPrice,
          department: created.department || targetDept,
          category: created.category || targetCat,
          subCategory: created.subCategory || 'General',
          prepStyle: created.prepStyle || 'Standard',
          tileColor: created.tileColor || '#2563eb',
          orderRoutingStation: created.orderRoutingStation || routing,
          customAddons: created.customAddons || [],
          recipeIngredients: created.recipeIngredients || [],
          trackStock: created.trackStock ?? true,
          currentStock: created.currentStock ?? 50,
          reorderLevel: created.reorderLevel ?? 10
        });

        // Ensure newly created item is in active view filters
        setSelectedDept(created.department || targetDept);
        setSelectedCat(created.category || targetCat);
        setSelectedSubCatFilter('ALL');
        setSelectedPrepStyleFilter('ALL');
        setSearchQuery('');
        setFormSuccess(`✓ Menu item "${created.name}" created successfully and added to POS!`);
      }
    } catch (err: any) {
      setFormError(`Failed to save item: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleDeleteItem = async (prodId: string) => {
    if (!confirm('Are you sure you want to permanently delete this menu item?')) return;
    await deleteProduct(prodId, true); // permanent delete
    setSelectedProductId(null);
  };

  // Parsed CSV rows for preview and structured import
  const parsedCsvRows = useMemo(() => {
    if (!bulkCsvText.trim()) return [];
    const lines = bulkCsvText.trim().split('\n');
    const rows: {
      id: number;
      department: string;
      category: string;
      name: string;
      price: number;
      subCategory: string;
      prepStyle: string;
      tileColor: string;
      orderRoutingStation: 'kitchen' | 'bar';
      isValid: boolean;
    }[] = [];

    lines.forEach((line, idx) => {
      const clean = line.trim();
      if (!clean || clean.startsWith('#') || clean.toLowerCase().startsWith('department')) return;

      const cols = clean.split(',').map(s => s.trim());
      if (cols.length >= 3) {
        const [dept, cat, name, priceStr, subCat, prep, color, routing] = cols;
        const price = parseFloat(priceStr) || 300;
        const station: 'kitchen' | 'bar' = (routing?.toLowerCase() === 'bar' || (!routing && dept?.toLowerCase() === 'drink')) ? 'bar' : 'kitchen';
        rows.push({
          id: idx + 1,
          department: dept || 'Food',
          category: cat || 'General',
          name: name || 'Unnamed Dish',
          price,
          subCategory: subCat || 'Standard',
          prepStyle: prep || 'Normal',
          tileColor: color && color.startsWith('#') ? color : '#2563eb',
          orderRoutingStation: station,
          isValid: Boolean(name && dept && cat)
        });
      }
    });

    return rows;
  }, [bulkCsvText]);

  // Handle Reading Uploaded File (.csv or .txt)
  const handleFileRead = (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
      setCsvFeedback({ type: 'error', message: 'Please select a valid .csv or .txt file.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setBulkCsvText(text);
        setUploadedFileName(file.name);
        const kb = (file.size / 1024).toFixed(1);
        setUploadedFileSize(`${kb} KB`);
        setCsvFeedback({ type: 'success', message: `Loaded file "${file.name}" successfully! Review preview below.` });
      }
    };
    reader.onerror = () => {
      setCsvFeedback({ type: 'error', message: 'Failed to read the file. Please check file permissions and try again.' });
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileRead(file);
    }
    // reset input so same file can be re-selected if needed
    e.target.value = '';
  };

  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileRead(file);
    }
  };

  // Download Sample CSV Template
  const handleDownloadTemplate = () => {
    const templateContent = [
      'Department,Category,Name,Price,SubCategory,PrepStyle,TileColorHex,OrderRoutingStation',
      'Food,Starters & Appetizers,Crispy Vegetable Spring Rolls,280,Veg,Crispy Fried,#d97706,kitchen',
      'Food,Main Courses,Chef Special Cottage Cheese Curry,420,Veg Mains,Slow Cooked Gravy,#059669,kitchen',
      'Food,Soups & Salads,Fresh Garden Herb Salad,240,Fresh Garden Salads,Tossed Dressing,#0284c7,kitchen',
      'Food,Desserts,Warm Himalayan Chocolate Brownie,300,Warm Desserts,Freshly Baked,#e11d48,kitchen',
      'Drink,Bar & Cocktails,Craft Draught Beer 500ml,450,Craft Beers,Draft Pour,#2563eb,bar',
      'Drink,Beverages,Fresh Mint Lime Cooler,220,Mocktails,Iced Cold,#06b6d4,bar',
      'Drink,Hot Drinks,Himalayan Spiced Masala Tea,120,Himalayan Teas,Claypot Spiced,#78350f,bar'
    ].join('\n');

    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'menu_hierarchy_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Bulk CSV Processor
  const handleProcessBulkCsv = async () => {
    if (parsedCsvRows.length === 0) {
      setCsvFeedback({ type: 'error', message: 'No valid items found to import. Please upload a CSV file or paste valid CSV rows.' });
      return;
    }
    setIsProcessingBulk(true);
    let imported = 0;

    for (const row of parsedCsvRows) {
      await addProduct({
        sku: generateUniqueSKU(row.category || 'ITEM', 'In-House Kitchen', activeProducts),
        barcode: generateUniqueBarcode(activeProducts),
        name: row.name,
        retailPrice: row.price,
        costPrice: Math.round(row.price * 0.35),
        wholesalePrice: row.price,
        department: row.department || 'Food',
        category: row.category || 'General',
        subCategory: row.subCategory || 'Standard',
        prepStyle: row.prepStyle || 'Normal',
        tileColor: row.tileColor || '#2563eb',
        orderRoutingStation: row.orderRoutingStation,
        brand: 'In-House Kitchen',
        baseUnit: 'Portion',
        baseUnitSymbol: 'portion',
        alternativeUnits: [],
        taxRatePercent: 13,
        trackStock: true,
        currentStock: 50,
        reorderLevel: 10,
        warehouseId: 'wh-main',
        warehouseName: 'Main Kitchen Store',
        hasVariants: false,
        itemType: row.department === 'Drink' ? 'beverage' : 'menu_item',
        status: 'active'
      });
      imported++;
    }

    setIsProcessingBulk(false);
    setCsvFeedback({ type: 'success', message: `🎉 Successfully imported ${imported} items into menu catalog!` });
    setBulkCsvText('');
    setUploadedFileName(null);
    setUploadedFileSize(null);
    setTimeout(() => {
      setActiveTab('browse');
    }, 1600);
  };

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden flex flex-col ${
      isModal ? 'max-w-7xl w-full max-h-[92vh] animate-in fade-in zoom-in-95' : 'w-full'
    }`}>
      {/* HEADER SECTION - QuickIMS Native Design */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Menu Studio</span>
            </h2>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-2xl p-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'browse'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold border border-slate-200/80 dark:border-slate-700 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Browse & Edit Menu</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('master')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'master'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold border border-slate-200/80 dark:border-slate-700 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Manage Hierarchy Levels</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bulk')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'bulk'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold border border-slate-200/80 dark:border-slate-700 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Bulk CSV</span>
            </button>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={handleStartNewItem}
            icon={<Plus className="w-4 h-4" />}
          >
            Create Item
          </Button>

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ===================== VIEW 1: BROWSE & EDIT MENU ===================== */}
      {activeTab === 'browse' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[640px] divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          
          {/* LEFT COLUMN: Department & Category Explorer (col-span-3) */}
          <div className="lg:col-span-3 p-4 flex flex-col justify-between bg-slate-50/40 dark:bg-slate-950/20 space-y-4">
            <div className="space-y-4">
              
              {/* 1. Root Departments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    1. Root Department
                  </span>
                  <button
                    type="button"
                    onClick={() => openCreateModal('dept')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-3xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {hierarchy.departments.map(dept => {
                    const isSelected = selectedDept === dept;
                    const count = activeProducts.filter(p => (p.department || 'Food') === dept).length;
                    return (
                      <div
                        key={dept}
                        onClick={() => setSelectedDept(dept)}
                        className={`group relative p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <span className="block text-xs font-bold truncate">{dept}</span>
                        <span className={`block text-3xs font-mono mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                          {count} items
                        </span>

                        {/* Quick edit/delete on hover */}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal('dept', dept);
                            }}
                            className={`p-0.5 rounded hover:bg-black/20 ${isSelected ? 'text-white' : 'text-slate-500'}`}
                            title="Rename"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                          {hierarchy.departments.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLevel('dept', dept);
                              }}
                              className="p-0.5 rounded hover:bg-rose-500 text-rose-300"
                              title="Delete"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Categories under Department */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    2. Categories in {selectedDept}
                  </span>
                  <button
                    type="button"
                    onClick={() => openCreateModal('cat')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-3xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </div>

                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {categoriesInDept.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                      <Tag className="w-5 h-5 text-slate-400 mx-auto" />
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        No categories in {selectedDept}
                      </p>
                      <p className="text-3xs text-slate-400">
                        Create your own category to organize your menu
                      </p>
                      <button
                        type="button"
                        onClick={() => openCreateModal('cat')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Category</span>
                      </button>
                    </div>
                  ) : (
                    categoriesInDept.map(cat => {
                    const isSelected = selectedCat === cat;
                    const catColor = hierarchy.categoryColors[cat] || '#2563eb';
                    const itemsInThisCat = activeProducts.filter(p => p.category === cat).length;
                    const subCount = (hierarchy.subCategories[cat] || []).length;

                    return (
                      <div
                        key={cat}
                        onClick={() => setSelectedCat(cat)}
                        className={`group p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-slate-900 text-white dark:bg-blue-950/70 border-slate-900 dark:border-blue-800 shadow-xs'
                            : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span 
                            className="w-3 h-3 rounded-full shrink-0 border border-white/30"
                            style={{ backgroundColor: catColor }}
                          />
                          <div className="truncate">
                            <span className="text-xs font-bold block truncate">{cat}</span>
                            <span className={`text-3xs ${isSelected ? 'text-slate-300 dark:text-blue-200' : 'text-slate-400'}`}>
                              {subCount} sub-types • {itemsInThisCat} items
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal('cat', cat);
                            }}
                            className={`p-1 rounded opacity-70 hover:opacity-100 ${isSelected ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-400'}`}
                            title="Edit Category"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLevel('cat', cat);
                            }}
                            className="p-1 rounded text-rose-400 hover:bg-rose-500/20"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick helper tip */}
            <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/60 text-3xs text-blue-700 dark:text-blue-300">
              <span className="font-bold block mb-0.5">Kitchen POS Flow:</span>
              <span>Items inherit tile color & route automatically to KDS Kitchen or BOT Bar based on Department.</span>
            </div>
          </div>

          {/* MIDDLE COLUMN: Menu Items List & Sub/Prep Filter (col-span-4) */}
          <div className="lg:col-span-4 p-4 flex flex-col justify-between bg-white dark:bg-slate-900 space-y-3">
            <div className="space-y-3">
              {/* Header with Search and Add Item button */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>{selectedCat ? `Items in ${selectedCat}` : `Items in ${selectedDept}`}</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-3xs font-mono font-bold text-slate-600 dark:text-slate-400">
                      {filteredItems.length}
                    </span>
                  </h3>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleStartNewItem}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Create Item
                </Button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search items by name, style, or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Items Card List */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredItems.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl space-y-2">
                    <Package className="w-6 h-6 text-slate-400 mx-auto" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {categoriesInDept.length === 0
                        ? `No categories in ${selectedDept} yet`
                        : (selectedCat ? `No items in ${selectedCat}` : 'Select or create a category to view items')}
                    </p>
                    {categoriesInDept.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => openCreateModal('cat')}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white cursor-pointer"
                      >
                        + Create Category
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartNewItem}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white cursor-pointer"
                      >
                        + Create Item
                      </button>
                    )}
                  </div>
                ) : (
                  filteredItems.map(item => {
                    const isSelected = selectedProductId === item.id;
                    const itemTileColor = item.tileColor || hierarchy.categoryColors[item.category] || '#2563eb';

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                        className={`group p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 shadow-xs ring-1 ring-blue-400'
                            : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span 
                            className="w-3.5 h-3.5 rounded-md mt-0.5 shrink-0 shadow-2xs border border-white/20"
                            style={{ backgroundColor: itemTileColor }}
                          />
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {item.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {item.subCategory && (
                                <span className="text-3xs px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                                  {item.subCategory}
                                </span>
                              )}
                              {item.prepStyle && (
                                <span className="text-3xs px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-medium">
                                  {item.prepStyle}
                                </span>
                              )}
                              {item.recipeIngredients && item.recipeIngredients.length > 0 && (
                                <span className="text-3xs px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-medium">
                                  {item.recipeIngredients.length} ingredients
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                            {formatNPR(item.retailPrice)}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(item.id);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title="Delete Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-3xs text-slate-400">
              <span>Showing {filteredItems.length} of {activeProducts.length} menu products</span>
              <span>Prices in NPR (रु)</span>
            </div>
          </div>

          {/* RIGHT COLUMN: Item Inspector & Recipe BOM Studio (col-span-5) */}
          <div className="lg:col-span-5 p-5 overflow-y-auto max-h-[750px] space-y-4 bg-slate-50/30 dark:bg-slate-900/60">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>{editingItem.id ? `Edit: ${editingItem.name || 'Unnamed Item'}` : `New Item in ${selectedCat}`}</span>
                  <span className="text-3xs font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                    {editingItem.department} &gt; {editingItem.category}
                  </span>
                </h3>
                <p className="text-3xs text-slate-500">
                  Configure hierarchy path, selling price, addons, and kitchen recipe BOM.
                </p>
              </div>

              {editingItem.id && (
                <button
                  type="button"
                  onClick={() => handleDeleteItem(editingItem.id!)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>

            {/* Inline Feedback Alerts */}
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            {formSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            {/* Basic Item Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-3xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Item Display Name <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={itemNameInputRef}
                  type="text"
                  value={editingItem.name}
                  onChange={(e) => {
                    setFormError(null);
                    setEditingItem({ ...editingItem, name: e.target.value });
                  }}
                  placeholder="Enter item name..."
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-3xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Selling Price (NPR) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-2xs font-bold text-slate-400">रु</span>
                  <input
                    type="number"
                    min="0"
                    value={editingItem.price}
                    onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-6 pr-2 py-1.5 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* 4-Level Hierarchy Assignment: Department, Category, Sub-Category & Prep Style */}
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">
                Hierarchy Mapping (4 Levels)
              </span>

              {/* Department & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-3xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    1. Department
                  </label>
                  <select
                    value={editingItem.department}
                    onChange={(e) => {
                      const newDept = e.target.value;
                      const cats = hierarchy.categories[newDept] || [];
                      const newCat = cats[0] || '';
                      const subs = hierarchy.subCategories[newCat] || ['General'];
                      const preps = hierarchy.prepStyles[newCat] || ['Standard'];
                      setEditingItem({
                        ...editingItem,
                        department: newDept,
                        category: newCat,
                        subCategory: subs[0] || 'General',
                        prepStyle: preps[0] || 'Standard',
                        orderRoutingStation: newDept === 'Drink' ? 'bar' : 'kitchen'
                      });
                      setSelectedDept(newDept);
                      if (newCat) setSelectedCat(newCat);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                  >
                    {hierarchy.departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-3xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    2. Category
                  </label>
                  <select
                    value={editingItem.category}
                    onChange={(e) => {
                      const newCat = e.target.value;
                      const subs = hierarchy.subCategories[newCat] || [];
                      const preps = hierarchy.prepStyles[newCat] || [];
                      const catColor = hierarchy.categoryColors[newCat] || editingItem.tileColor;
                      setEditingItem({
                        ...editingItem,
                        category: newCat,
                        subCategory: subs[0] || '',
                        prepStyle: preps[0] || '',
                        tileColor: catColor
                      });
                      if (newCat) setSelectedCat(newCat);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                  >
                    {(hierarchy.categories[editingItem.department] || []).length === 0 ? (
                      <option value="">No categories (Add category first)</option>
                    ) : (
                      <>
                        <option value="">-- Select Category --</option>
                        {(hierarchy.categories[editingItem.department] || []).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Sub-Category & Prep Style */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-3xs font-bold text-slate-500 uppercase tracking-wider">
                      3. Sub-Category
                    </label>
                    <button
                      type="button"
                      onClick={() => openCreateModal('subCat')}
                      className="text-3xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                    >
                      + New Sub
                    </button>
                  </div>
                  <select
                    value={editingItem.subCategory}
                    onChange={(e) => setEditingItem({ ...editingItem, subCategory: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                  >
                    {(hierarchy.subCategories[editingItem.category] || ['General']).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-3xs font-bold text-slate-500 uppercase tracking-wider">
                      4. Prep Style
                    </label>
                    <button
                      type="button"
                      onClick={() => openCreateModal('prepStyle')}
                      className="text-3xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                    >
                      + New Prep
                    </button>
                  </div>
                  <select
                    value={editingItem.prepStyle}
                    onChange={(e) => setEditingItem({ ...editingItem, prepStyle: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                  >
                    {(hierarchy.prepStyles[editingItem.category] || ['Standard']).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Automated Order Routing Station Toggle (KOT vs BOT) */}
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xs font-bold text-slate-500 uppercase tracking-wider block">
                  Order Dispatch Station (KOT vs BOT)
                </span>
                <span className={`text-3xs font-black uppercase px-2 py-0.5 rounded-full ${
                  editingItem.orderRoutingStation === 'bar'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                }`}>
                  {editingItem.orderRoutingStation === 'bar' ? '🍸 Bar BOT' : '🍳 Kitchen KOT'}
                </span>
              </div>
              <p className="text-3xs text-slate-400">
                Automates smart ticket distribution: food orders route to Kitchen KDS; drink orders route to Bar BOT station.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingItem({ ...editingItem, orderRoutingStation: 'kitchen' })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                    editingItem.orderRoutingStation !== 'bar'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <ChefHat className="w-3.5 h-3.5" />
                  <span>Kitchen (KDS)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingItem({ ...editingItem, orderRoutingStation: 'bar' })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                    editingItem.orderRoutingStation === 'bar'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Wine className="w-3.5 h-3.5" />
                  <span>Bar (BOT)</span>
                </button>
              </div>
            </div>

            {/* Tile Color Picker */}
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">
                POS Tile Color Accent
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {TILE_COLORS.map(color => {
                  const isSelected = editingItem.tileColor === color.hex;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => setEditingItem({ ...editingItem, tileColor: color.hex })}
                      className={`w-7 h-7 rounded-lg transition-transform cursor-pointer flex items-center justify-center ${
                        isSelected ? 'scale-110 ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Addons Section */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Custom Addons &amp; Modifiers (NPR)</span>
                </span>
                <span className="text-3xs text-slate-400">{editingItem.customAddons.length} added</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tempAddonName}
                  onChange={(e) => setTempAddonName(e.target.value)}
                  placeholder="e.g. Extra Golbheda Achar, Cheese Slice"
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
                <div className="relative w-24">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-2xs text-slate-400">रु</span>
                  <input
                    type="number"
                    min="0"
                    value={tempAddonPrice}
                    onChange={(e) => setTempAddonPrice(parseFloat(e.target.value) || 0)}
                    className="w-full pl-6 pr-2 py-1.5 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddAddon}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-2xs"
                >
                  + Add
                </button>
              </div>

              {editingItem.customAddons.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {editingItem.customAddons.map((addon, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-2xs font-semibold border border-blue-200 dark:border-blue-900"
                    >
                      <span>{addon.name}</span>
                      <span className="font-mono text-3xs font-bold text-blue-600 dark:text-blue-400">+{formatNPR(addon.price)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAddon(idx)}
                        className="text-blue-400 hover:text-rose-500 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* RECIPE BOM & INGREDIENT STOCK DEDUCTION */}
            <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-3xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ChefHat className="w-4 h-4 text-blue-600" />
                    <span>Kitchen Recipe BOM &amp; Food Costing</span>
                  </span>
                  <p className="text-3xs text-blue-700/80 dark:text-blue-400 mt-0.5">
                    Add raw stock ingredients to track recipe portion cost and deplete pantry upon KDS orders.
                  </p>
                </div>

                {/* Fix: Working Add Ingredient button */}
                <button
                  type="button"
                  onClick={handleAddRecipeIngredient}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-3xs font-bold cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Ingredient</span>
                </button>
              </div>

              {editingItem.recipeIngredients.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-blue-200 dark:border-blue-800/80 rounded-xl text-3xs text-blue-700 dark:text-blue-400 space-y-1.5">
                  <p>No ingredients linked to this recipe yet.</p>
                  <button
                    type="button"
                    onClick={handleAddRecipeIngredient}
                    className="text-blue-600 dark:text-blue-300 underline font-bold cursor-pointer"
                  >
                    Click "+ Add Ingredient" to start portion costing
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {editingItem.recipeIngredients.map((ing, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800 space-y-2.5 text-2xs">
                      {/* Row 1: Basis of Category & Ingredient Name + Remove */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        {/* Basis of Category */}
                        <div className="w-full sm:w-1/3">
                          <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                            Category
                          </label>
                          <select
                            value={ing.category || ''}
                            onChange={(e) => {
                              const newCat = e.target.value;
                              const firstInCat = rawIngredients.find(r => !newCat || r.category === newCat);
                              if (firstInCat && newCat && newCat !== 'Custom') {
                                handleUpdateRecipeIngredient(idx, {
                                  category: newCat,
                                  ingredientId: firstInCat.id,
                                  ingredientName: firstInCat.name,
                                  unit: firstInCat.unit || 'kg',
                                  costPerUnit: firstInCat.costPrice || 0,
                                  currentStock: firstInCat.currentStock || 0
                                });
                              } else {
                                handleUpdateRecipeIngredient(idx, { category: newCat });
                              }
                            }}
                            className="w-full p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                          >
                            <option value="">All Categories</option>
                            {rawIngredientCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                            <option value="Custom">Custom / Other</option>
                          </select>
                        </div>

                        {/* Ingredient Name */}
                        <div className="flex-1">
                          <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                            Ingredient Name
                          </label>
                          {rawIngredients.length > 0 && ing.category !== 'Custom' ? (
                            <select
                              value={ing.ingredientId || ing.ingredientName}
                              onChange={(e) => {
                                const val = e.target.value;
                                const found = rawIngredients.find(r => r.id === val || r.name === val);
                                if (found) {
                                  handleUpdateRecipeIngredient(idx, {
                                    ingredientId: found.id,
                                    ingredientName: found.name,
                                    category: found.category || ing.category,
                                    unit: found.unit || 'kg',
                                    costPerUnit: found.costPrice || 0,
                                    currentStock: found.currentStock || 0
                                  });
                                } else {
                                  handleUpdateRecipeIngredient(idx, {
                                    ingredientId: '',
                                    ingredientName: val,
                                    costPerUnit: 0
                                  });
                                }
                              }}
                              className="w-full p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                            >
                              <option value="">-- Select Ingredient --</option>
                              {rawIngredients
                                .filter(r => !ing.category || r.category === ing.category)
                                .map(r => (
                                  <option key={r.id} value={r.id}>
                                    {r.name} ({r.unit || 'unit'}) - रु {r.costPrice || 0}/{r.unit || 'unit'} [Stock: {r.currentStock ?? 0}]
                                  </option>
                                ))}
                              {ing.ingredientName && !rawIngredients.some(r => r.id === ing.ingredientId || r.name === ing.ingredientName) && (
                                <option value={ing.ingredientName}>Custom: {ing.ingredientName}</option>
                              )}
                            </select>
                          ) : (
                            <input
                              type="text"
                              placeholder="Enter ingredient name (e.g. Flour, Timmur)..."
                              value={ing.ingredientName}
                              onChange={(e) => handleUpdateRecipeIngredient(idx, { ingredientName: e.target.value })}
                              className="w-full p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                            />
                          )}
                        </div>

                        <div className="pt-2 sm:pt-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipeIngredient(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer transition-colors"
                            title="Remove ingredient"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Row 2: Quantity, Unit, Cost per Unit, Line Total */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center bg-slate-50/70 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div>
                          <label className="block text-3xs font-semibold text-slate-400 mb-0.5">Portion Qty</label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0"
                            value={ing.quantityRequired || ''}
                            onChange={(e) => handleUpdateRecipeIngredient(idx, { quantityRequired: parseFloat(e.target.value) || 0 })}
                            className="w-full p-1 text-xs text-right font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-3xs font-semibold text-slate-400 mb-0.5">Unit</label>
                          <select
                            value={ing.unit || 'kg'}
                            onChange={(e) => handleUpdateRecipeIngredient(idx, { unit: e.target.value })}
                            className="w-full p-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          >
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                            <option value="L">L</option>
                            <option value="ml">ml</option>
                            <option value="pcs">pcs</option>
                            <option value="portion">portion</option>
                            <option value="pack">pack</option>
                            <option value="btl">btl</option>
                            <option value="can">can</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-3xs font-semibold text-slate-400 mb-0.5">Cost / Unit</label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-3xs text-slate-400">रु</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={ing.costPerUnit || ''}
                              placeholder="0"
                              onChange={(e) => handleUpdateRecipeIngredient(idx, { costPerUnit: parseFloat(e.target.value) || 0 })}
                              className="w-full pl-6 pr-1 py-1 text-xs text-right font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            />
                          </div>
                        </div>

                        <div className="text-right">
                          <label className="block text-3xs font-semibold text-slate-400 mb-0.5">Line Total</label>
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                            {formatNPR(ing.totalCost)}
                          </span>
                        </div>
                      </div>

                      {/* Row 3: Stock tracking info and Auto-Depletion */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-1 text-3xs border-t border-slate-100 dark:border-slate-800 text-slate-500">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const raw = rawIngredients.find(r => r.id === ing.ingredientId || r.name === ing.ingredientName);
                            if (raw) {
                              const stock = raw.currentStock ?? 0;
                              return (
                                <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full ${
                                  stock > 10 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300' 
                                    : stock > 0 
                                      ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300' 
                                      : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                                }`}>
                                  <Boxes className="w-3 h-3" />
                                  <span>Pantry Stock: {stock} {raw.unit || ing.unit}</span>
                                </span>
                              );
                            }
                            return (
                              <span className="text-slate-400 italic">Custom unlinked pantry item</span>
                            );
                          })()}
                        </div>

                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300 hover:text-blue-600 font-medium">
                          <input
                            type="checkbox"
                            checked={ing.trackStock !== false}
                            onChange={(e) => handleUpdateRecipeIngredient(idx, { trackStock: e.target.checked })}
                            className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span>Deplete pantry stock on POS sales</span>
                        </label>
                      </div>
                    </div>
                  ))}

                  {/* Food Control & Recipe Intelligence Summary */}
                  <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-900 space-y-2 text-2xs">
                    <div className="flex items-center justify-between font-bold text-blue-950 dark:text-blue-200">
                      <div>
                        <span>Total Recipe BOM: </span>
                        <span className="font-mono text-xs">{formatNPR(totalBOMCost)}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {totalBOMCost > 0 ? (
                          <span className={`px-2 py-0.5 rounded-full text-3xs font-bold ${
                            foodCostPercent > 35 
                              ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300' 
                              : foodCostPercent <= 30
                                ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                          }`}>
                            Food Cost: {foodCostPercent}% {foodCostPercent > 35 ? '⚠️ High Cost' : foodCostPercent <= 30 ? '✓ Optimal (<30%)' : '✓ Target'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            Pending Ingredients
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Food Control Margins Breakdown */}
                    {editingItem.price > 0 && (
                      <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/60 flex items-center justify-between text-3xs text-slate-600 dark:text-slate-300">
                        <span>Selling Price: <strong className="font-mono text-slate-900 dark:text-slate-100">{formatNPR(editingItem.price)}</strong></span>
                        <span>Contribution Margin: <strong className="font-mono text-emerald-600 dark:text-emerald-400">+{formatNPR(Math.max(0, editingItem.price - totalBOMCost))}</strong> ({editingItem.price > 0 ? Math.round(((editingItem.price - totalBOMCost) / editingItem.price) * 100) : 0}%)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Save Action */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleSaveItem}
                icon={<Check className="w-4 h-4" />}
              >
                {editingItem.id ? 'Save Item Changes' : 'Create Item'}
              </Button>
            </div>
          </div>

        </div>
      )}

      {/* ===================== VIEW 2: HIERARCHY MASTER SETUP (ALL 4 LEVELS) ===================== */}
      {activeTab === 'master' && (
        <div className="p-5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Menu Architecture Master Configuration
              </h3>
              <p className="text-xs text-slate-500">
                Manage all 4 levels: Create, rename, or delete Root Departments, Categories, Sub-Categories, and Prep Styles.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (confirm('Reset menu hierarchy to standard default Nepali restaurant schema?')) {
                  setHierarchy(DEFAULT_HIERARCHY);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>

          {/* 4 Dedicated Management Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Level 1: Root Departments */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span>1. Departments</span>
                  </h4>
                  <p className="text-3xs text-slate-400">Top-level POS tabs</p>
                </div>

                <button
                  type="button"
                  onClick={() => openCreateModal('dept')}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-3xs font-bold cursor-pointer"
                >
                  + Add
                </button>
              </div>

              <div className="space-y-1.5">
                {hierarchy.departments.map(dept => {
                  const itemsCount = activeProducts.filter(p => (p.department || 'Food') === dept).length;
                  return (
                    <div key={dept} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{dept}</span>
                        <span className="text-3xs text-slate-400">{itemsCount} products</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal('dept', dept)}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 cursor-pointer"
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        {hierarchy.departments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteLevel('dept', dept)}
                            className="p-1 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Level 2: Categories (Under Selected Dept) */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>2. Categories</span>
                  </h4>
                  <p className="text-3xs text-slate-400">In {selectedDept}</p>
                </div>

                <button
                  type="button"
                  onClick={() => openCreateModal('cat')}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-3xs font-bold cursor-pointer"
                >
                  + Add
                </button>
              </div>

              <div className="space-y-1.5">
                {categoriesInDept.map(cat => {
                  const color = hierarchy.categoryColors[cat] || '#2563eb';
                  const isSelected = selectedCat === cat;

                  return (
                    <div 
                      key={cat} 
                      onClick={() => setSelectedCat(cat)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-800 shadow-2xs' 
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{cat}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal('cat', cat);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 cursor-pointer"
                          title="Rename / Color"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLevel('cat', cat);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Level 3: Sub-Categories (Under Selected Category) */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>3. Sub-Categories</span>
                  </h4>
                  <p className="text-3xs text-slate-400">In {selectedCat} (e.g. Chick, Veg, Buff)</p>
                </div>

                <button
                  type="button"
                  onClick={() => openCreateModal('subCat')}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-3xs font-bold cursor-pointer"
                >
                  + Add
                </button>
              </div>

              <div className="space-y-1.5">
                {subCategoriesInCat.map(sub => (
                  <div key={sub} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{sub}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal('subCat', sub)}
                        className="p-1 rounded text-slate-400 hover:text-blue-600 cursor-pointer"
                        title="Rename"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLevel('subCat', sub)}
                        className="p-1 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Level 4: Prep Styles (Under Selected Category) */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>4. Prep Styles</span>
                  </h4>
                  <p className="text-3xs text-slate-400">In {selectedCat} (e.g. Steam, Fry, Jhol)</p>
                </div>

                <button
                  type="button"
                  onClick={() => openCreateModal('prepStyle')}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-3xs font-bold cursor-pointer"
                >
                  + Add
                </button>
              </div>

              <div className="space-y-1.5">
                {prepStylesInCat.map(prep => (
                  <div key={prep} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{prep}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal('prepStyle', prep)}
                        className="p-1 rounded text-slate-400 hover:text-blue-600 cursor-pointer"
                        title="Rename"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLevel('prepStyle', prep)}
                        className="p-1 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ===================== VIEW 3: BULK CSV IMPORT ===================== */}
      {activeTab === 'bulk' && (
        <div className="p-5 max-w-4xl mx-auto space-y-5">
          {/* Header & Template Download */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>Bulk CSV Menu Hierarchy Import</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload your menu spreadsheet (.csv) or paste rows to mass-import dishes with automatic kitchen/bar routing.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer shrink-0"
              title="Download structured template with sample food & bar records"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Sample CSV</span>
            </button>
          </div>

          {/* Feedback Banner */}
          {csvFeedback && (
            <div className={`p-3 rounded-2xl flex items-center justify-between gap-2 text-xs font-bold border animate-in fade-in ${
              csvFeedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}>
              <div className="flex items-center gap-2">
                {csvFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{csvFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setCsvFeedback(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Mode Tabs: Upload File vs Paste Text */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 gap-1 text-xs">
              <button
                type="button"
                onClick={() => setBulkCsvMode('upload')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  bulkCsvMode === 'upload'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Upload CSV File</span>
              </button>
              <button
                type="button"
                onClick={() => setBulkCsvMode('paste')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  bulkCsvMode === 'paste'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Paste Raw Text</span>
              </button>
            </div>

            <span className="text-3xs text-slate-400 font-mono">
              Columns: Dept, Category, Name, Price, SubCat, Prep, Color, Station
            </span>
          </div>

          {/* UPLOAD FILE TAB */}
          {bulkCsvMode === 'upload' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleFileUpload}
                className="hidden"
              />

              {uploadedFileName ? (
                /* Selected File Card */
                <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border-2 border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{uploadedFileName}</span>
                        {uploadedFileSize && (
                          <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                            {uploadedFileSize}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {parsedCsvRows.length} valid items parsed and ready for import
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
                    >
                      Change File
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBulkCsvText('');
                        setUploadedFileName(null);
                        setUploadedFileSize(null);
                      }}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-600 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-800 cursor-pointer transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                /* Drag & Drop Zone */
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={handleDropFile}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-8 border-2 border-dashed rounded-3xl text-center flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                    isDraggingFile
                      ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 ring-4 ring-blue-200 dark:ring-blue-900/40 scale-[1.01]'
                      : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-800/20 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                    <FileUp className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Drag &amp; drop your CSV file here, or <span className="text-blue-600 dark:text-blue-400 underline">browse</span>
                    </p>
                    <p className="text-xs text-slate-400 max-w-md">
                      Upload .csv or .txt files formatted with columns for Department, Category, Item Name, Price, and optional Order Routing Station.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-3xs font-mono text-slate-500 shadow-2xs">
                    <span>Supports Excel / Google Sheets exported CSV files</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASTE TEXT TAB */}
          {bulkCsvMode === 'paste' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-2xs font-mono space-y-1">
                <span className="text-slate-400 block font-sans font-bold">CSV Format:</span>
                <code className="text-blue-600 dark:text-blue-300 block">
                  Department, Category, Name, Price, SubCategory, PrepStyle, TileColorHex, OrderRoutingStation
                </code>
                <span className="text-slate-500 block pt-1">Example:</span>
                <code className="text-slate-600 dark:text-slate-300 block">
                  Food, Starters & Appetizers, Crispy Vegetable Spring Rolls, 280, Veg, Crispy Fried, #d97706, kitchen
                </code>
              </div>

              <textarea
                rows={7}
                value={bulkCsvText}
                onChange={(e) => setBulkCsvText(e.target.value)}
                placeholder="Paste your CSV rows here (Department, Category, Name, Price, SubCategory, PrepStyle, TileColorHex, Station)..."
                className="w-full p-3 font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-blue-500"
              />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setBulkCsvText(
`Food, Starters & Appetizers, Crispy Vegetable Spring Rolls, 280, Veg, Crispy Fried, #d97706, kitchen
Food, Main Courses, Chef Special Cottage Cheese Curry, 420, Veg Mains, Slow Cooked Gravy, #059669, kitchen
Food, Soups & Salads, Fresh Garden Herb Salad, 240, Fresh Garden Salads, Tossed Dressing, #0284c7, kitchen
Food, Desserts, Warm Himalayan Chocolate Brownie, 300, Warm Desserts, Freshly Baked, #e11d48, kitchen
Drink, Bar & Cocktails, Craft Draught Beer 500ml, 450, Craft Beers, Draft Pour, #2563eb, bar
Drink, Beverages, Fresh Mint Lime Cooler, 220, Mocktails, Iced Cold, #06b6d4, bar
Drink, Hot Drinks, Himalayan Spiced Masala Tea, 120, Himalayan Teas, Claypot Spiced, #78350f, bar`
                    );
                    setUploadedFileName('sample_menu_records.csv');
                    setUploadedFileSize('0.8 KB');
                  }}
                  className="px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-bold"
                >
                  Insert Sample Rows
                </button>

                {bulkCsvText && (
                  <button
                    type="button"
                    onClick={() => {
                      setBulkCsvText('');
                      setUploadedFileName(null);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Clear text
                  </button>
                )}
              </div>
            </div>
          )}

          {/* PARSED ITEMS PREVIEW TABLE */}
          {parsedCsvRows.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Items Detected for Import ({parsedCsvRows.length})</span>
                </h4>
                <span className="text-3xs text-slate-400 font-mono">
                  Food items route to KDS • Drinks route to Bar BOT
                </span>
              </div>

              <div className="border border-slate-200 dark:border-slate-700/80 rounded-2xl overflow-hidden shadow-2xs bg-white dark:bg-slate-900">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/90 text-2xs uppercase font-extrabold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2.5 pl-3">#</th>
                        <th className="p-2.5">Item Name</th>
                        <th className="p-2.5">Hierarchy (Dept &gt; Cat)</th>
                        <th className="p-2.5">SubCategory / Prep</th>
                        <th className="p-2.5 text-right">Price</th>
                        <th className="p-2.5 text-center pr-3">Dispatch Station</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                      {parsedCsvRows.slice(0, 15).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 pl-3 font-mono text-3xs text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: row.tileColor }}
                              />
                              <span>{row.name}</span>
                            </div>
                          </td>
                          <td className="p-2.5 text-2xs text-slate-600 dark:text-slate-300">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{row.department}</span>
                            <span className="text-slate-400 mx-1">›</span>
                            <span>{row.category}</span>
                          </td>
                          <td className="p-2.5 text-2xs text-slate-500">
                            {row.subCategory} • {row.prepStyle}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            {formatNPR(row.price)}
                          </td>
                          <td className="p-2.5 text-center pr-3">
                            {row.orderRoutingStation === 'bar' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-3xs font-black uppercase">
                                <Wine className="w-2.5 h-2.5" />
                                <span>Bar (BOT)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-3xs font-black uppercase">
                                <ChefHat className="w-2.5 h-2.5" />
                                <span>Kitchen (KDS)</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {parsedCsvRows.length > 15 && (
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/50 text-center text-3xs text-slate-500 border-t border-slate-100 dark:border-slate-800">
                    + {parsedCsvRows.length - 15} more items parsed from file
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500 font-medium">
              {parsedCsvRows.length > 0 
                ? `${parsedCsvRows.length} item${parsedCsvRows.length > 1 ? 's' : ''} ready to add into menu catalog`
                : 'Upload a CSV file or paste rows above to proceed'}
            </span>

            <button
              type="button"
              disabled={parsedCsvRows.length === 0 || isProcessingBulk}
              onClick={handleProcessBulkCsv}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl cursor-pointer transition-all shadow-md shadow-blue-600/20 flex items-center gap-2"
            >
              {isProcessingBulk ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing Items...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Import {parsedCsvRows.length > 0 ? `${parsedCsvRows.length} ` : ''}CSV Items</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ===================== HIERARCHY LEVEL CREATE/EDIT MODAL ===================== */}
      {manageModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {manageModal.mode === 'create' ? `Add New ${manageModal.type}` : `Edit ${manageModal.type}`}
              </h3>
              <p className="text-3xs text-slate-500">
                {manageModal.type === 'dept' && 'Top level root tab (e.g. Food, Drink, Combos, Bakery)'}
                {manageModal.type === 'cat' && `Category under ${manageModal.parentDept}`}
                {manageModal.type === 'subCat' && `Sub-Category under ${manageModal.parentCategory}`}
                {manageModal.type === 'prepStyle' && `Preparation Style under ${manageModal.parentCategory}`}
              </p>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-3">
              <div>
                <label className="block text-3xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Name
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={modalInputValue}
                  onChange={(e) => setModalInputValue(e.target.value)}
                  placeholder={`Enter ${manageModal.type} name...`}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {manageModal.type === 'cat' && (
                <div>
                  <label className="block text-3xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Tile Color Accent
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {TILE_COLORS.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setModalColorValue(c.hex)}
                        className={`w-6 h-6 rounded-md cursor-pointer ${modalColorValue === c.hex ? 'ring-2 ring-blue-500 scale-110' : ''}`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setManageModal({ open: false, type: 'dept', mode: 'create' })}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  {manageModal.mode === 'create' ? 'Create' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
