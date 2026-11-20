import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Printer, Sliders, CheckCircle2, RotateCcw, Save, Eye, 
  Sparkles, ShieldCheck, Ruler, Type, Layout, Check, 
  ChevronRight, Scissors, QrCode, AlignLeft, Percent, 
  Info, AlertTriangle, FileText, ChefHat, Wine, Receipt,
  BookmarkPlus, Pencil, Trash2, Play, Layers, X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button } from '../common/Button';
import { 
  ReceiptTemplateConfig, 
  ReceiptPaperWidth, 
  ReceiptFontSizeScale, 
  ReceiptFontFamily, 
  ReceiptLineSpacing, 
  ReceiptDividerStyle,
  ReceiptTemplateTarget,
  SavedReceiptTemplate,
  SaleInvoice,
  KitchenOrderTicket,
  POSPrinterConfig
} from '../../types';
import { 
  DEFAULT_RECEIPT_TEMPLATE_80MM, 
  DEFAULT_RECEIPT_TEMPLATE_58MM 
} from '../../data/restaurantInitialData';
import { 
  getEffectiveReceiptTemplate, 
  generateBillReceiptSlipHtml, 
  generateTestSlipHtml, 
  generateKOTSlipHtml,
  generateBOTSlipHtml,
  executeThermalPrint 
} from '../../utils/printerService';
import { formatNPR } from '../../utils/nepalFormatters';

interface ReceiptLayoutEditorProps {
  onBackToPrinters?: () => void;
}

export const ReceiptLayoutEditor: React.FC<ReceiptLayoutEditorProps> = ({ onBackToPrinters }) => {
  const { settings, updateSettings, printers, canStaffDo } = useApp();
  const canCreateTemplate = canStaffDo('settingsPrinters', 'write');
  const canUpdateLayout = canStaffDo('settingsPrinters', 'update');
  const canDeleteTemplate = canStaffDo('settingsPrinters', 'delete');

  const TARGET_META: Record<ReceiptTemplateTarget, { label: string; shortLabel: string; hint: string }> = {
    all: { label: 'All Slips (Default)', shortLabel: 'All Slips', hint: 'Universal fallback for all printouts' },
    bill: { label: 'Customer Bill / Invoice', shortLabel: 'Customer Bill', hint: 'POS checkout & table bills' },
    kot: { label: 'Kitchen KOT', shortLabel: 'Kitchen KOT', hint: 'Kitchen food preparation tickets' },
    bot: { label: 'Bar BOT', shortLabel: 'Bar BOT', hint: 'Bar & beverage dispense tickets' }
  };

  const resolveScopeTemplate = (
    scope: ReceiptTemplateTarget,
    savedId: string | null,
    s = settings
  ): ReceiptTemplateConfig => {
    if (savedId) {
      const found = (s.savedReceiptTemplates || []).find(t => t.id === savedId);
      if (found) {
        return getEffectiveReceiptTemplate(found.config.paperWidth || '80mm', found.config);
      }
    }
    if (scope !== 'all') {
      const targeted = s.receiptTemplatesByTarget?.[scope];
      if (targeted && typeof targeted === 'object') {
        return getEffectiveReceiptTemplate(targeted.paperWidth || '80mm', targeted);
      }
    }
    return getEffectiveReceiptTemplate(
      s.receiptTemplate?.paperWidth || '80mm',
      s.receiptTemplate
    );
  };

  const [editingScope, setEditingScope] = useState<ReceiptTemplateTarget>('all');
  const [editingSavedTemplateId, setEditingSavedTemplateId] = useState<string | null>(
    () => settings.activeReceiptTemplateIds?.all || null
  );

  // Active working template state
  const [template, setTemplate] = useState<ReceiptTemplateConfig>(() =>
    resolveScopeTemplate('all', settings.activeReceiptTemplateIds?.all || null, settings)
  );

  const [activeTab, setActiveTab] = useState<'paper' | 'styling' | 'columns' | 'sections'>('paper');
  const [previewSlipType, setPreviewSlipType] = useState<'bill' | 'kot' | 'bot' | 'test'>('bill');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [templateFilter, setTemplateFilter] = useState<'everything' | ReceiptTemplateTarget>('everything');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Save / Edit Template modal state
  const [templateModal, setTemplateModal] = useState<{
    mode: 'create' | 'edit';
    templateId?: string;
    name: string;
    target: ReceiptTemplateTarget;
    description: string;
    activateNow: boolean;
    applyCurrentLayout: boolean;
  } | null>(null);

  const savedTemplates = settings.savedReceiptTemplates || [];
  const activeIds = settings.activeReceiptTemplateIds || {};

  const isDirtyRef = useRef(false);

  const buildSettingsPatchForWorkingTemplate = (
    nextTemplate: ReceiptTemplateConfig,
    scope: ReceiptTemplateTarget,
    savedId: string | null
  ) => {
    const s = settings;
    const list = s.savedReceiptTemplates || [];
    const currentActiveIds = s.activeReceiptTemplateIds || {};
    const targetSaved = savedId ? list.find(t => t.id === savedId) : undefined;

    if (targetSaved) {
      const updatedList = list.map(t =>
        t.id === targetSaved.id ? { ...t, config: nextTemplate, updatedAt: Date.now() } : t
      );
      const isCurrentlyActiveForTarget = currentActiveIds[targetSaved.target] === targetSaved.id;
      if (!isCurrentlyActiveForTarget) {
        return { savedReceiptTemplates: updatedList };
      }
      if (targetSaved.target === 'all') {
        return {
          savedReceiptTemplates: updatedList,
          receiptTemplate: nextTemplate
        };
      }
      return {
        savedReceiptTemplates: updatedList,
        receiptTemplatesByTarget: {
          ...(s.receiptTemplatesByTarget || {}),
          [targetSaved.target]: nextTemplate
        }
      };
    }

    if (scope === 'all') {
      return { receiptTemplate: nextTemplate };
    }

    return {
      receiptTemplatesByTarget: {
        ...(s.receiptTemplatesByTarget || {}),
        [scope]: nextTemplate
      }
    };
  };

  // Sync from cloud/settings when no unsaved local edit is pending
  useEffect(() => {
    if (isDirtyRef.current) return;
    setTemplate(resolveScopeTemplate(editingScope, editingSavedTemplateId, settings));
  }, [settings.receiptTemplate, settings.receiptTemplatesByTarget, settings.savedReceiptTemplates, editingScope, editingSavedTemplateId]);

  // Explicit Save Changes handler (replaces auto-saving on every edit)
  const handleSaveChanges = async () => {
    if (!canUpdateLayout) return;
    setIsSavingChanges(true);
    try {
      const patch = buildSettingsPatchForWorkingTemplate(
        template,
        editingScope,
        editingSavedTemplateId
      );
      await updateSettings(patch);
      isDirtyRef.current = false;
      setHasUnsavedChanges(false);

      const activeEditing = editingSavedTemplateId
        ? savedTemplates.find(t => t.id === editingSavedTemplateId)
        : undefined;

      setStatusNotice({
        type: 'success',
        message: activeEditing
          ? `Saved changes to "${activeEditing.name}" (${TARGET_META[activeEditing.target].label}).`
          : `Saved layout changes for ${TARGET_META[editingScope].label}! Actual POS bills and slips will now use this layout.`
      });
    } catch (err: any) {
      setStatusNotice({
        type: 'error',
        message: err?.message || 'Failed to save layout changes.'
      });
    } finally {
      setIsSavingChanges(false);
    }
  };

  const handleDiscardChanges = () => {
    isDirtyRef.current = false;
    setHasUnsavedChanges(false);
    setTemplate(resolveScopeTemplate(editingScope, editingSavedTemplateId, settings));
    setStatusNotice({
      type: 'info',
      message: 'Discarded unsaved layout changes.'
    });
  };

  // Switch which operation / active layout is being edited
  const handleSelectScope = (scope: ReceiptTemplateTarget) => {
    isDirtyRef.current = false;
    setHasUnsavedChanges(false);
    const activeIdForScope = settings.activeReceiptTemplateIds?.[scope] || null;
    setEditingScope(scope);
    setEditingSavedTemplateId(activeIdForScope);
    setTemplate(resolveScopeTemplate(scope, activeIdForScope, settings));
    if (scope === 'bill' || scope === 'kot' || scope === 'bot') {
      setPreviewSlipType(scope);
    }
  };

  // Restore factory Default Layout (for current scope or all scopes)
  const handleRestoreDefaultLayout = async (paperWidth: '80mm' | '58mm', resetAllScopes: boolean = false) => {
    if (!canUpdateLayout) return;
    isDirtyRef.current = false;
    setHasUnsavedChanges(false);
    const defTpl = paperWidth === '58mm'
      ? { ...DEFAULT_RECEIPT_TEMPLATE_58MM }
      : { ...DEFAULT_RECEIPT_TEMPLATE_80MM };

    if (resetAllScopes) {
      setEditingScope('all');
      setEditingSavedTemplateId(null);
      setTemplate(defTpl);
      await updateSettings({
        receiptTemplate: defTpl,
        receiptTemplatesByTarget: { bill: null, kot: null, bot: null },
        activeReceiptTemplateIds: { all: null, bill: null, kot: null, bot: null }
      });
      setStatusNotice({
        type: 'success',
        message: `Restored factory Default ${paperWidth} Layout across All Slips, Bills, KOT, and BOT.`
      });
      return;
    }

    if (editingScope === 'all') {
      setEditingSavedTemplateId(null);
      setTemplate(defTpl);
      await updateSettings({
        receiptTemplate: defTpl,
        activeReceiptTemplateIds: {
          ...(settings.activeReceiptTemplateIds || {}),
          all: null
        }
      });
      setStatusNotice({
        type: 'success',
        message: `Default ${paperWidth} layout restored and applied to All Slips.`
      });
    } else {
      // Clear per-operation override so it inherits the Default Layout cleanly
      const scope = editingScope;
      setEditingSavedTemplateId(null);
      const inherited = getEffectiveReceiptTemplate(
        settings.receiptTemplate?.paperWidth || '80mm',
        settings.receiptTemplate
      );
      setTemplate(inherited);
      await updateSettings({
        receiptTemplatesByTarget: {
          ...(settings.receiptTemplatesByTarget || {}),
          [scope]: null
        },
        activeReceiptTemplateIds: {
          ...(settings.activeReceiptTemplateIds || {}),
          [scope]: null
        }
      });
      setStatusNotice({
        type: 'success',
        message: `${TARGET_META[scope].label} now uses your Default Layout.`
      });
    }
  };

  // Clear override for a specific operation badge back to Default Layout
  const handleClearScopeOverride = async (scope: 'bill' | 'kot' | 'bot') => {
    if (!canUpdateLayout) return;
    isDirtyRef.current = false;
    setHasUnsavedChanges(false);
    if (editingScope === scope) {
      setEditingSavedTemplateId(null);
      setTemplate(getEffectiveReceiptTemplate(settings.receiptTemplate?.paperWidth || '80mm', settings.receiptTemplate));
    }
    await updateSettings({
      receiptTemplatesByTarget: {
        ...(settings.receiptTemplatesByTarget || {}),
        [scope]: null
      },
      activeReceiptTemplateIds: {
        ...(settings.activeReceiptTemplateIds || {}),
        [scope]: null
      }
    });
    setStatusNotice({
      type: 'info',
      message: `${TARGET_META[scope].label} reverted to Default Layout.`
    });
  };

  // Immediately activate and use a saved template
  const handleUseSavedTemplate = async (saved: SavedReceiptTemplate) => {
    if (!canUpdateLayout) return;
    isDirtyRef.current = false;
    setHasUnsavedChanges(false);
    const effectiveConfig = getEffectiveReceiptTemplate(saved.config.paperWidth || '80mm', saved.config);
    setEditingScope(saved.target);
    setEditingSavedTemplateId(saved.id);
    setTemplate(effectiveConfig);
    if (saved.target === 'bill' || saved.target === 'kot' || saved.target === 'bot') {
      setPreviewSlipType(saved.target);
    }

    const patch: any = {
      activeReceiptTemplateIds: {
        ...(settings.activeReceiptTemplateIds || {}),
        [saved.target]: saved.id
      }
    };
    if (saved.target === 'all') {
      patch.receiptTemplate = effectiveConfig;
    } else {
      patch.receiptTemplatesByTarget = {
        ...(settings.receiptTemplatesByTarget || {}),
        [saved.target]: effectiveConfig
      };
    }

    await updateSettings(patch);
    setStatusNotice({
      type: 'success',
      message: `"${saved.name}" is now active for ${TARGET_META[saved.target].label} and will be used immediately!`
    });
  };

  // Load a saved template into the editor for editing
  const handleEditSavedTemplate = (saved: SavedReceiptTemplate) => {
    isDirtyRef.current = false;
    setHasUnsavedChanges(false);
    const effectiveConfig = getEffectiveReceiptTemplate(saved.config.paperWidth || '80mm', saved.config);
    setEditingScope(saved.target);
    setEditingSavedTemplateId(saved.id);
    setTemplate(effectiveConfig);
    if (saved.target === 'bill' || saved.target === 'kot' || saved.target === 'bot') {
      setPreviewSlipType(saved.target);
    }
    setStatusNotice({
      type: 'info',
      message: `Editing "${saved.name}" (${TARGET_META[saved.target].label}). Make adjustments below and click "Save Changes" to update.`
    });
  };

  const handleDeleteSavedTemplate = async (id: string) => {
    if (!canDeleteTemplate) return;
    const target = savedTemplates.find(t => t.id === id);
    const remaining = savedTemplates.filter(t => t.id !== id);
    const nextActiveIds = { ...(settings.activeReceiptTemplateIds || {}) };
    (Object.keys(nextActiveIds) as ReceiptTemplateTarget[]).forEach(k => {
      if (nextActiveIds[k] === id) {
        nextActiveIds[k] = null;
      }
    });

    if (editingSavedTemplateId === id) {
      isDirtyRef.current = false;
      setHasUnsavedChanges(false);
      setEditingSavedTemplateId(null);
      setTemplate(resolveScopeTemplate(editingScope, null, { ...settings, activeReceiptTemplateIds: nextActiveIds }));
    }
    setConfirmDeleteId(null);

    await updateSettings({
      savedReceiptTemplates: remaining,
      activeReceiptTemplateIds: nextActiveIds
    });
    setStatusNotice({
      type: 'info',
      message: `Deleted saved template${target ? ` "${target.name}"` : ''}.`
    });
  };

  const openSaveTemplateModal = (mode: 'create' | 'edit', existing?: SavedReceiptTemplate) => {
    if (mode === 'create' && !canCreateTemplate) return;
    if (mode === 'edit' && !canUpdateLayout) return;
    if (mode === 'edit' && existing) {
      setTemplateModal({
        mode: 'edit',
        templateId: existing.id,
        name: existing.name,
        target: existing.target,
        description: existing.description || '',
        activateNow: activeIds[existing.target] === existing.id,
        applyCurrentLayout: editingSavedTemplateId === existing.id
      });
    } else {
      const suggestedLabel = editingScope === 'bill'
        ? 'Custom Tax Bill'
        : editingScope === 'kot'
        ? 'Custom Kitchen KOT'
        : editingScope === 'bot'
        ? 'Custom Bar BOT'
        : 'Custom Receipt Layout';
      setTemplateModal({
        mode: 'create',
        name: suggestedLabel,
        target: editingScope,
        description: '',
        activateNow: true,
        applyCurrentLayout: true
      });
    }
  };

  const handleConfirmTemplateModal = async () => {
    if (!templateModal) return;
    if (templateModal.mode === 'create' && !canCreateTemplate) return;
    if (templateModal.mode === 'edit' && !canUpdateLayout) return;
    const cleanName = templateModal.name.trim();
    if (!cleanName) {
      setStatusNotice({ type: 'error', message: 'Please enter a template name.' });
      return;
    }

    isDirtyRef.current = false;
    const now = Date.now();
    const list = [...(settings.savedReceiptTemplates || [])];
    let savedEntry: SavedReceiptTemplate;
    let nextActiveIds = { ...(settings.activeReceiptTemplateIds || {}) };
    let nextByTarget = { ...(settings.receiptTemplatesByTarget || {}) };
    let nextDefault = settings.receiptTemplate;

    if (templateModal.mode === 'edit' && templateModal.templateId) {
      const prev = list.find(t => t.id === templateModal.templateId);
      const nextConfig = templateModal.applyCurrentLayout
        ? { ...template }
        : (prev?.config || { ...template });

      savedEntry = {
        id: templateModal.templateId,
        name: cleanName,
        target: templateModal.target,
        description: templateModal.description.trim() || undefined,
        config: nextConfig,
        createdAt: prev?.createdAt || now,
        updatedAt: now
      };

      const idx = list.findIndex(t => t.id === templateModal.templateId);
      if (idx >= 0) list[idx] = savedEntry;
      else list.unshift(savedEntry);

      // If target changed, clear old active reference if it pointed to this template
      if (prev && prev.target !== savedEntry.target && nextActiveIds[prev.target] === savedEntry.id) {
        nextActiveIds[prev.target] = null;
      }
    } else {
      savedEntry = {
        id: `tpl-${now}-${Math.random().toString(36).slice(2, 7)}`,
        name: cleanName,
        target: templateModal.target,
        description: templateModal.description.trim() || undefined,
        config: { ...template },
        createdAt: now,
        updatedAt: now
      };
      list.unshift(savedEntry);
    }

    if (templateModal.activateNow) {
      nextActiveIds[savedEntry.target] = savedEntry.id;
      if (savedEntry.target === 'all') {
        nextDefault = savedEntry.config;
      } else {
        nextByTarget[savedEntry.target] = savedEntry.config;
      }
    }

    setEditingScope(savedEntry.target);
    setEditingSavedTemplateId(savedEntry.id);
    setTemplate(getEffectiveReceiptTemplate(savedEntry.config.paperWidth || '80mm', savedEntry.config));
    if (savedEntry.target === 'bill' || savedEntry.target === 'kot' || savedEntry.target === 'bot') {
      setPreviewSlipType(savedEntry.target);
    }

    await updateSettings({
      savedReceiptTemplates: list,
      activeReceiptTemplateIds: nextActiveIds,
      receiptTemplatesByTarget: nextByTarget,
      ...(nextDefault ? { receiptTemplate: nextDefault } : {})
    });

    setTemplateModal(null);
    setHasUnsavedChanges(false);
    setStatusNotice({
      type: 'success',
      message: templateModal.activateNow
        ? `Saved "${savedEntry.name}" for ${TARGET_META[savedEntry.target].label} and activated immediately!`
        : `Saved template "${savedEntry.name}" (${TARGET_META[savedEntry.target].label}). Click "Use Now" whenever you want to apply it.`
    });
  };

  const updateField = <K extends keyof ReceiptTemplateConfig>(key: K, value: ReceiptTemplateConfig[K]) => {
    isDirtyRef.current = true;
    setHasUnsavedChanges(true);
    setTemplate(prev => ({ ...prev, [key]: value }));
  };

  const updateColumn = <K extends keyof ReceiptTemplateConfig['columns']>(
    key: K,
    value: ReceiptTemplateConfig['columns'][K]
  ) => {
    isDirtyRef.current = true;
    setHasUnsavedChanges(true);
    setTemplate(prev => ({
      ...prev,
      columns: { ...prev.columns, [key]: value }
    }));
  };

  const handlePaperWidthChange = (width: ReceiptPaperWidth) => {
    isDirtyRef.current = true;
    setHasUnsavedChanges(true);
    if (width === '58mm') {
      setTemplate(prev => ({
        ...prev,
        paperWidth: '58mm',
        printableWidthMm: 46,
        paddingLeftMm: 1,
        paddingRightMm: 1.5,
        fontSizeScale: 'compact',
        lineSpacing: 'tight',
        columns: {
          ...prev.columns,
          showRate: false,
          itemColWidthPercent: 54,
          qtyColWidthPercent: 16,
          rateColWidthPercent: 0,
          amtColWidthPercent: 30
        }
      }));
    } else {
      setTemplate(prev => ({
        ...prev,
        paperWidth: '80mm',
        printableWidthMm: 66,
        paddingLeftMm: 1.5,
        paddingRightMm: 2.5,
        fontSizeScale: prev.fontSizeScale === 'compact' ? 'normal' : prev.fontSizeScale,
        lineSpacing: prev.lineSpacing === 'tight' ? 'normal' : prev.lineSpacing,
        columns: {
          ...prev.columns,
          showRate: true,
          itemColWidthPercent: 46,
          qtyColWidthPercent: 14,
          rateColWidthPercent: 18,
          amtColWidthPercent: 22
        }
      }));
    }
  };

  const applyPreset = (preset: 'safe80' | 'compact58' | 'boldLarge' | 'minimal' | 'detailed') => {
    isDirtyRef.current = true;
    setHasUnsavedChanges(true);
    if (preset === 'safe80') {
      setTemplate({ ...DEFAULT_RECEIPT_TEMPLATE_80MM });
      setStatusNotice({ type: 'info', message: 'Applied Safe 80mm (Zero Cutoff) preset.' });
    } else if (preset === 'compact58') {
      setTemplate({ ...DEFAULT_RECEIPT_TEMPLATE_58MM });
      setStatusNotice({ type: 'info', message: 'Applied 58mm Roll Compact preset.' });
    } else if (preset === 'boldLarge') {
      setTemplate(prev => ({
        ...prev,
        paperWidth: '80mm',
        printableWidthMm: 66,
        paddingLeftMm: 1.5,
        paddingRightMm: 2.5,
        fontSizeScale: 'large',
        lineSpacing: 'relaxed',
        dividerStyle: 'double'
      }));
      setStatusNotice({ type: 'info', message: 'Applied High Legibility (Large) preset.' });
    } else if (preset === 'minimal') {
      setTemplate(prev => ({
        ...prev,
        lineSpacing: 'tight',
        showTagline: false,
        showCustomerInfo: false,
        showItemModifiers: false,
        showTaxableAmount: false,
        showVatBreakdown: false,
        showQrCode: false,
        showQuickimsBranding: false
      }));
      setStatusNotice({ type: 'info', message: 'Applied Minimalist / Paper Saver preset.' });
    } else if (preset === 'detailed') {
      setTemplate(prev => ({
        ...prev,
        showStoreName: true,
        showTagline: true,
        showAddress: true,
        showPhone: true,
        showPanVat: true,
        showInvoiceTitle: true,
        showTableBadge: true,
        showServerName: true,
        showDateTime: true,
        showCustomerInfo: true,
        showItemModifiers: true,
        showSpecialNotes: true,
        showSubtotal: true,
        showDiscount: true,
        showTaxableAmount: true,
        showVatBreakdown: true,
        showGrandTotalHighlight: true,
        showPaymentMethod: true,
        showChangeDue: true,
        showQrCode: true,
        showFooterMessage: true,
        showCutLine: true,
        columns: {
          ...prev.columns,
          showRate: true,
          itemColWidthPercent: 46,
          qtyColWidthPercent: 14,
          rateColWidthPercent: 18,
          amtColWidthPercent: 22
        }
      }));
      setStatusNotice({ type: 'info', message: 'Applied Full Tax Breakdown preset.' });
    }
  };

  // Mock data for live interactive preview
  const sampleInvoice: SaleInvoice = useMemo(() => ({
    id: 'inv-preview-1',
    invoiceNumber: 'INV-2082-0492',
    date: Date.now(),
    fiscalYear: settings.fiscalYear || '2082/83',
    customerId: 'cust-walkin',
    customerName: 'Table Guest',
    customerType: 'retail',
    customerPanVat: '302918274',
    salespersonId: 'staff-cashier',
    salespersonName: 'Billing Cashier',
    warehouseId: 'wh-main',
    warehouseName: 'Main Store',
    createdAt: Date.now(),
    subtotal: 1145,
    discountAmount: 45,
    taxableAmount: 1100,
    taxAmount: 143,
    nonTaxableAmount: 0,
    grandTotal: 1243,
    totalCost: 450,
    grossProfit: 793,
    paymentMethod: 'cash',
    paidAmount: 1300,
    dueAmount: 0,
    paymentStatus: 'paid',
    status: 'completed',
    items: [
      {
        productId: 'p1',
        productName: 'Steamed Momo (10 pcs)',
        sku: 'MOMO-STM',
        selectedUnit: 'Plate',
        conversionFactor: 1,
        quantity: 2,
        baseQuantity: 2,
        unitPrice: 280,
        costPrice: 90,
        discountPercent: 0,
        discountAmount: 0,
        taxRatePercent: 13,
        taxAmount: 72.8,
        lineTotal: 560
      },
      {
        productId: 'p2',
        productName: 'Craft Draught Beer 650ml',
        sku: 'BEER-01',
        selectedUnit: 'Bottle',
        conversionFactor: 1,
        quantity: 1,
        baseQuantity: 1,
        unitPrice: 450,
        costPrice: 220,
        discountPercent: 0,
        discountAmount: 0,
        taxRatePercent: 13,
        taxAmount: 58.5,
        lineTotal: 450
      },
      {
        productId: 'p3',
        productName: 'Mineral Water 1L Bottle',
        sku: 'WAT-01',
        selectedUnit: 'Bottle',
        conversionFactor: 1,
        quantity: 3,
        baseQuantity: 3,
        unitPrice: 45,
        costPrice: 15,
        discountPercent: 0,
        discountAmount: 0,
        taxRatePercent: 13,
        taxAmount: 17.55,
        lineTotal: 135
      }
    ]
  }), [settings.fiscalYear]);

  const sampleKOT: KitchenOrderTicket = useMemo(() => ({
    id: 'kot-preview-1',
    kotNumber: 'KOT-0082',
    ticketType: 'KOT',
    destinationStation: 'kitchen',
    tableId: 't-1',
    tableNumber: 'M-01',
    zoneName: 'Main Dining Hall',
    waiterName: 'Floor Server 1',
    guestsCount: 4,
    status: 'in_kitchen',
    notes: 'Please expedite starter dishes first!',
    createdAt: Date.now() - 360000,
    updatedAt: Date.now() - 360000,
    items: [
      {
        id: 'ki-1',
        productId: 'p1',
        productName: 'Steamed Momo (10 pcs)',
        quantity: 2,
        unitPrice: 280,
        course: 'appetizer',
        specialInstructions: 'Extra spicy timur dip',
        selectedModifiers: [{ modifierName: 'Sauce', optionName: 'House Timur Dip', priceDelta: 0 }],
        status: 'preparing',
        firedAt: Date.now() - 360000
      },
      {
        id: 'ki-2',
        productId: 'p2',
        productName: 'House Special Fried Chicken',
        quantity: 1,
        unitPrice: 450,
        course: 'main',
        specialInstructions: 'Crispy skin, chef garnish',
        status: 'preparing',
        firedAt: Date.now() - 360000
      }
    ]
  }), []);

  const sampleBOT: KitchenOrderTicket = useMemo(() => ({
    id: 'bot-preview-1',
    kotNumber: 'BOT-0014',
    ticketType: 'BOT',
    destinationStation: 'bar',
    tableId: 't-1',
    tableNumber: 'M-01',
    zoneName: 'Bar / Dining',
    waiterName: 'Floor Server 1',
    guestsCount: 4,
    status: 'in_kitchen',
    notes: 'Serve with chilled beer glasses and lemon slices',
    createdAt: Date.now() - 360000,
    updatedAt: Date.now() - 360000,
    items: [
      {
        id: 'bi-1',
        productId: 'b1',
        productName: 'Craft Draught Beer 650ml',
        quantity: 2,
        unitPrice: 450,
        course: 'beverage',
        specialInstructions: 'Chilled bottle with lime',
        status: 'preparing',
        firedAt: Date.now() - 360000
      },
      {
        id: 'bi-2',
        productId: 'b2',
        productName: 'Classic Virgin Mojito Mint',
        quantity: 1,
        unitPrice: 220,
        course: 'beverage',
        specialInstructions: 'Less ice, fresh crushed mint',
        status: 'preparing',
        firedAt: Date.now() - 360000
      }
    ]
  }), []);

  // Primary printer for testing
  const targetPrinter = useMemo(() => {
    return printers.find(p => p.isActive && (p.station === 'billing' || p.station === 'all')) || 
           printers[0] || {
             id: 'prn-preview',
             name: 'Thermal POS Printer',
             station: 'billing' as const,
             connectionType: 'universal' as const,
             paperWidth: template.paperWidth,
             isDefault: true,
             isActive: true,
             autoPrintKOT: false,
             autoPrintBOT: false,
             autoPrintBill: true,
             copiesCount: 1
           };
  }, [printers, template.paperWidth]);

  // Dispatch Test Print with current customized settings
  const handlePrintTestSlip = async () => {
    setIsTestPrinting(true);
    try {
      const mergedPrinter: POSPrinterConfig = {
        ...targetPrinter,
        paperWidth: template.paperWidth
      };
      const mergedSettings = {
        ...settings,
        receiptTemplate: template,
        receiptTemplatesByTarget: {
          ...(settings.receiptTemplatesByTarget || {}),
          ...(previewSlipType !== 'test' ? { [previewSlipType]: template } : {})
        }
      };
      
      let html = '';
      let rawPayload: any = { type: 'test', settings: mergedSettings };
      if (previewSlipType === 'bill') {
        const previewTable = { id: 't1', tableNumber: 'M-01' } as any;
        html = generateBillReceiptSlipHtml(sampleInvoice, previewTable, mergedPrinter, mergedSettings);
        rawPayload = { type: 'bill', data: { invoice: sampleInvoice, table: previewTable }, settings: mergedSettings };
      } else if (previewSlipType === 'kot') {
        html = generateKOTSlipHtml(sampleKOT, mergedPrinter, mergedSettings);
        rawPayload = { type: 'kot', data: sampleKOT, settings: mergedSettings };
      } else if (previewSlipType === 'bot') {
        html = generateBOTSlipHtml(sampleBOT, mergedPrinter, mergedSettings);
        rawPayload = { type: 'bot', data: sampleBOT, settings: mergedSettings };
      } else {
        html = generateTestSlipHtml(mergedPrinter, mergedSettings);
      }

      const res = await executeThermalPrint(html, mergedPrinter, rawPayload);
      setStatusNotice({
        type: res.success ? 'success' : 'error',
        message: res.success 
          ? `Dispatched "${previewSlipType.toUpperCase()}" test print! Check your physical thermal printer to verify numbers and margins.`
          : res.message
      });
    } catch (err: any) {
      setStatusNotice({ type: 'error', message: err?.message || 'Print dispatch failed.' });
    } finally {
      setIsTestPrinting(false);
    }
  };

  const is58 = template.paperWidth === '58mm';
  const cols = template.columns;
  const rollMm = is58 ? 58 : 80;
  const rollWidthPx = is58 ? 240 : 320;
  const printableWidthPx = Math.round((template.printableWidthMm / rollMm) * rollWidthPx);
  const leftPaddingPx = Math.round((template.paddingLeftMm / rollMm) * rollWidthPx);
  const rightBufferPx = Math.round((template.paddingRightMm / rollMm) * rollWidthPx);
  const rightRollerMarginMm = Math.max(0, rollMm - (template.printableWidthMm + template.paddingLeftMm));
  const isSafeMargin = template.paddingRightMm >= 2.0 && template.printableWidthMm <= (is58 ? 48 : 68);

  // Dynamic typography classes
  const fontScaleClass = useMemo(() => {
    switch (template.fontSizeScale) {
      case 'compact':
        return {
          base: 'text-[9px] sm:text-[9.5px]',
          title: 'text-[11.5px] sm:text-[12px]',
          heading: 'text-[10px] sm:text-[10.5px]',
          badge: 'text-[7.5px] sm:text-[8px]',
          small: 'text-[7.5px] sm:text-[8px]'
        };
      case 'large':
        return {
          base: 'text-[11.5px] sm:text-[12.5px]',
          title: 'text-[14.5px] sm:text-[15.5px]',
          heading: 'text-[12.5px] sm:text-[13.5px]',
          badge: 'text-[9.5px] sm:text-[10px]',
          small: 'text-[9.5px] sm:text-[10px]'
        };
      case 'normal':
      default:
        return {
          base: 'text-[10px] sm:text-[11px]',
          title: 'text-[13px] sm:text-[14px]',
          heading: 'text-[11px] sm:text-[12px]',
          badge: 'text-[8.5px] sm:text-[9px]',
          small: 'text-[8.5px] sm:text-[9px]'
        };
    }
  }, [template.fontSizeScale]);

  const lineSpacingClass = useMemo(() => {
    switch (template.lineSpacing) {
      case 'tight':
        return {
          space: 'space-y-1',
          leading: 'leading-[1.18]',
          tablePadding: 'py-0.5',
          margin: 'my-1'
        };
      case 'relaxed':
        return {
          space: 'space-y-2.5',
          leading: 'leading-[1.6]',
          tablePadding: 'py-1.5',
          margin: 'my-2'
        };
      case 'normal':
      default:
        return {
          space: 'space-y-1.5',
          leading: 'leading-[1.35]',
          tablePadding: 'py-1',
          margin: 'my-1.5'
        };
    }
  }, [template.lineSpacing]);

  const fontFamilyClass = template.fontFamily === 'mono' ? 'font-mono' : 'font-sans';

  // Dynamic divider helper
  const renderDivider = (type: 'single' | 'double' | 'cut' = 'single') => {
    if (type === 'cut') {
      const cutLineClass = 
        template.dividerStyle === 'dotted' ? 'border-dotted' :
        template.dividerStyle === 'solid' ? 'border-solid' :
        template.dividerStyle === 'double' ? 'border-double border-t-2' :
        'border-dashed';

      return (
        <div className={`text-center text-[8px] text-slate-500 pt-1.5 border-t ${cutLineClass} border-black my-1 transition-all`}>
          {template.cutLineText || '- - - - - - - THANK YOU - - - - - - -'}
        </div>
      );
    }

    if (type === 'double' || template.dividerStyle === 'double') {
      return <div className="border-t-4 border-double border-black my-1.5 transition-all" />;
    }

    const styleClass = 
      template.dividerStyle === 'dotted' ? 'border-dotted' :
      template.dividerStyle === 'solid' ? 'border-solid' :
      'border-dashed';

    return <div className={`border-t-2 ${styleClass} border-black my-1.5 transition-all`} />;
  };

  const renderSingleDivider = () => {
    const styleClass = 
      template.dividerStyle === 'dotted' ? 'border-dotted' :
      template.dividerStyle === 'solid' ? 'border-solid' :
      template.dividerStyle === 'double' ? 'border-solid' :
      'border-dashed';

    return <div className={`border-t ${styleClass} border-black my-1 transition-all`} />;
  };

  return (
    <div className="space-y-5 animate-in fade-in">
      
      {/* Toast Notice */}
      {statusNotice && (
        <div className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold border shadow-md animate-in slide-in-from-top-2 ${
          statusNotice.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
            : statusNotice.type === 'error'
            ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            : 'bg-blue-50 dark:bg-blue-950/70 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            {statusNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : statusNotice.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{statusNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Receipt &amp; Printout Layout Editor</span>
              <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                Zero-Cutoff Calibration
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize thermal paper widths, margins, font sizes, line dividers, and add or remove invoice &amp; KOT sections.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {onBackToPrinters && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onBackToPrinters}
            >
              ← Back to Printers
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            disabled={isTestPrinting}
            onClick={handlePrintTestSlip}
            icon={<Printer className="w-4 h-4 text-blue-600" />}
          >
            {isTestPrinting ? 'Printing...' : 'Print Test Slip'}
          </Button>

          {canCreateTemplate && (
            <Button
              variant="primary-arrow"
              size="sm"
              onClick={() => openSaveTemplateModal('create')}
              icon={<BookmarkPlus className="w-4 h-4" />}
            >
              Save as Template
            </Button>
          )}
        </div>
      </div>

      {/* DEFAULT LAYOUT & REUSABLE SAVED TEMPLATES */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Default Layout &amp; Reusable Saved Templates</span>
            </h2>
            <p className="text-2xs text-slate-500 mt-0.5">
              Choose which slip type you are customizing, restore the default layout anytime, or save &amp; reuse named templates for Bills, KOT, or BOT.
            </p>
          </div>

          {canUpdateLayout && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => void handleRestoreDefaultLayout('80mm', false)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-2xs cursor-pointer transition-all flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{editingScope === 'all' ? 'Default 80mm Layout' : `Use Default for ${TARGET_META[editingScope].shortLabel}`}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleRestoreDefaultLayout('58mm', false)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-2xs cursor-pointer transition-all border border-slate-200 dark:border-slate-700"
              >
                Default 58mm
              </button>
              {(settings.receiptTemplatesByTarget?.bill || settings.receiptTemplatesByTarget?.kot || settings.receiptTemplatesByTarget?.bot) && (
                <button
                  type="button"
                  onClick={() => void handleRestoreDefaultLayout('80mm', true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-bold text-2xs cursor-pointer transition-all border border-rose-200 dark:border-rose-800"
                >
                  Reset All to Default
                </button>
              )}
            </div>
          )}
        </div>

        {/* Active Layout by Printout Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {(['all', 'bill', 'kot', 'bot'] as ReceiptTemplateTarget[]).map(scope => {
            const isSelectedScope = editingScope === scope && !editingSavedTemplateId;
            const activeTpl = activeIds[scope] ? savedTemplates.find(t => t.id === activeIds[scope]) : undefined;
            const hasOverride = scope !== 'all' && Boolean(settings.receiptTemplatesByTarget?.[scope]);
            const ScopeIcon = scope === 'bill' ? Receipt : scope === 'kot' ? ChefHat : scope === 'bot' ? Wine : Sparkles;

            return (
              <div
                key={scope}
                onClick={() => handleSelectScope(scope)}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                  editingScope === scope
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-2xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      editingScope === scope
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}>
                      <ScopeIcon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-slate-100">{TARGET_META[scope].label}</div>
                      <div className="text-3xs text-slate-500">{TARGET_META[scope].hint}</div>
                    </div>
                  </div>
                  {isSelectedScope && (
                    <span className="text-3xs font-black px-1.5 py-0.5 rounded bg-indigo-600 text-white shrink-0">
                      Editing
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70 dark:border-slate-800">
                  <span className="text-3xs font-bold text-slate-700 dark:text-slate-300 truncate">
                    Active: {activeTpl ? activeTpl.name : hasOverride ? 'Custom Override' : scope === 'all' ? `Default (${settings.receiptTemplate?.paperWidth || '80mm'})` : 'Inherits Default'}
                  </span>
                  {scope !== 'all' && hasOverride && canUpdateLayout && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleClearScopeOverride(scope);
                      }}
                      className="text-3xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 cursor-pointer"
                    >
                      Use Default
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Currently Editing Saved Template Banner */}
        {editingSavedTemplateId && (() => {
          const activeEditing = savedTemplates.find(t => t.id === editingSavedTemplateId);
          if (!activeEditing) return null;
          const isCurrentlyLive = activeIds[activeEditing.target] === activeEditing.id;
          return (
            <div className="p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-black text-3xs uppercase">Editing Template</span>
                <span className="font-black text-slate-900 dark:text-slate-100">{activeEditing.name}</span>
                <span className="text-2xs font-bold text-indigo-700 dark:text-indigo-300">• For {TARGET_META[activeEditing.target].label}</span>
                {isCurrentlyLive ? (
                  <span className="text-3xs font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    ✓ Active &amp; Live
                  </span>
                ) : (
                  <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                    Draft Only (Not Active Yet)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {!isCurrentlyLive && canUpdateLayout && (
                  <button
                    type="button"
                    onClick={() => void handleUseSavedTemplate(activeEditing)}
                    className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-2xs cursor-pointer flex items-center gap-1"
                  >
                    <Play className="w-3 h-3" />
                    <span>Use Immediately</span>
                  </button>
                )}
                {canUpdateLayout && (
                  <button
                    type="button"
                    onClick={() => openSaveTemplateModal('edit', activeEditing)}
                    className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-2xs cursor-pointer flex items-center gap-1 hover:bg-slate-50"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Rename / Change Purpose</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    isDirtyRef.current = false;
                    setHasUnsavedChanges(false);
                    setEditingSavedTemplateId(null);
                    setTemplate(resolveScopeTemplate(editingScope, null, settings));
                  }}
                  className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-2xs cursor-pointer hover:bg-slate-50"
                >
                  Done Editing
                </button>
              </div>
            </div>
          );
        })()}

        {/* Saved Templates Library */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                Saved Templates ({savedTemplates.length})
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {(['everything', 'all', 'bill', 'kot', 'bot'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setTemplateFilter(f)}
                    className={`px-2 py-0.5 rounded-lg text-3xs font-bold cursor-pointer transition-all ${
                      templateFilter === f
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {f === 'everything' ? 'All Saved' : TARGET_META[f].shortLabel}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(() => {
            const visibleTemplates = savedTemplates.filter(t => templateFilter === 'everything' || t.target === templateFilter);
            if (visibleTemplates.length === 0) {
              return (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center text-2xs text-slate-500">
                  {savedTemplates.length === 0
                    ? 'No saved templates yet. Customize your layout below and click "Save as Template" to name it (e.g. "Counter 80mm Bill", "Fast Kitchen KOT") and reuse it anytime.'
                    : 'No saved templates match this filter.'}
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {visibleTemplates.map(saved => {
                  const isActive = activeIds[saved.target] === saved.id;
                  const isEditing = editingSavedTemplateId === saved.id;

                  return (
                    <div
                      key={saved.id}
                      className={`p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 ${
                        isEditing
                          ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30'
                          : isActive
                          ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-black text-xs text-slate-900 dark:text-slate-100 leading-tight">{saved.name}</div>
                          {isActive && (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white font-black text-3xs shrink-0">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap text-3xs">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                            For: {TARGET_META[saved.target].label}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold">
                            {saved.config.paperWidth} • {saved.config.printableWidthMm}mm
                          </span>
                        </div>
                        {saved.description && (
                          <p className="text-3xs text-slate-500 dark:text-slate-400 line-clamp-2">{saved.description}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200/70 dark:border-slate-700/60">
                        {canUpdateLayout ? (
                          <button
                            type="button"
                            onClick={() => void handleUseSavedTemplate(saved)}
                            className={`px-2.5 py-1 rounded-lg font-bold text-3xs cursor-pointer flex items-center gap-1 transition-all ${
                              isActive
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                          >
                            <Play className="w-3 h-3" />
                            <span>{isActive ? 'Re-Apply' : 'Use Now'}</span>
                          </button>
                        ) : (
                          <span className="text-3xs font-semibold text-slate-400">View Only</span>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleEditSavedTemplate(saved)}
                            className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 font-bold text-3xs cursor-pointer"
                            title="Load layout into editor"
                          >
                            {canUpdateLayout ? 'Edit Layout' : 'Preview Layout'}
                          </button>
                          {canUpdateLayout && (
                            <button
                              type="button"
                              onClick={() => openSaveTemplateModal('edit', saved)}
                              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 cursor-pointer"
                              title="Rename or change What For"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                          {canDeleteTemplate && (
                            confirmDeleteId === saved.id ? (
                              <button
                                type="button"
                                onClick={() => void handleDeleteSavedTemplate(saved.id)}
                                className="px-2 py-1 rounded-lg bg-rose-600 text-white font-bold text-3xs cursor-pointer"
                              >
                                Confirm
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(saved.id)}
                                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Delete template"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* QUICK PRESETS STRIP */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 overflow-x-auto text-xs">
        <div className="flex items-center gap-2 shrink-0">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="font-bold text-slate-700 dark:text-slate-300">Quick Presets:</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => applyPreset('safe80')}
            className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-2xs cursor-pointer transition-all border border-slate-200 dark:border-slate-700"
          >
            🛡️ Safe 80mm (Zero Cutoff)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('compact58')}
            className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-2xs cursor-pointer transition-all border border-slate-200 dark:border-slate-700"
          >
            🧾 58mm Roll Compact
          </button>
          <button
            type="button"
            onClick={() => applyPreset('boldLarge')}
            className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-2xs cursor-pointer transition-all border border-slate-200 dark:border-slate-700"
          >
            🔍 High Legibility (Large)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('minimal')}
            className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-2xs cursor-pointer transition-all border border-slate-200 dark:border-slate-700"
          >
            🍃 Minimalist / Paper Saver
          </button>
          <button
            type="button"
            onClick={() => applyPreset('detailed')}
            className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-2xs cursor-pointer transition-all border border-slate-200 dark:border-slate-700"
          >
            📑 Full Tax Breakdown
          </button>
          <button
            type="button"
            onClick={() => applyPreset('safe80')}
            className="px-2.5 py-1 rounded-xl text-slate-400 hover:text-rose-600 font-bold text-2xs cursor-pointer flex items-center gap-1 transition-all"
            title="Reset working layout to Default 80mm"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to Default</span>
          </button>
        </div>
      </div>

      {/* TWO-COLUMN WORKBENCH: CONTROLS (7 COLS) & LIVE PREVIEW (5 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: CUSTOMIZATION CONTROLS */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Editor Sub-Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('paper')}
              className={`py-2 px-2 text-center rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'paper'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Ruler className="w-3.5 h-3.5" />
              <span>Paper &amp; Margins</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('styling')}
              className={`py-2 px-2 text-center rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'styling'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Font &amp; Lines</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('columns')}
              className={`py-2 px-2 text-center rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'columns'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>Item Columns</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sections')}
              className={`py-2 px-2 text-center rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'sections'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Add / Remove</span>
            </button>
          </div>

          {/* TAB 1: PAPER & MARGINS (ZERO-CUTOFF CALIBRATION) */}
          {activeTab === 'paper' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-5">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-indigo-600" />
                  <span>Paper Roll &amp; Hardware Edge Calibration</span>
                </h3>
                <p className="text-2xs text-slate-500 mt-1">
                  Adjust roll width, printable span, and right margin safety buffers in real-time. Notice how the roll preview instantly expands, contracts, and protects numbers from roller cut-off.
                </p>
              </div>

              {/* LIVE HARDWARE ROLL CALIBRATOR BAR */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${isSafeMargin ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                      Hardware Roll Cross-Section ({template.paperWidth})
                    </span>
                  </div>
                  <span className={`text-2xs font-mono font-bold px-2 py-0.5 rounded-lg border ${
                    isSafeMargin 
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  }`}>
                    {isSafeMargin ? '✓ Zero Cutoff Safe' : '⚠️ Tight Right Margin'}
                  </span>
                </div>

                {/* Proportional visual cross-section bar */}
                <div className="space-y-1.5">
                  <div className="h-7 w-full rounded-xl overflow-hidden flex text-[9px] font-mono font-bold border border-slate-300 dark:border-slate-700 shadow-inner">
                    <div 
                      className="bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all duration-300"
                      style={{ width: `${Math.max(4, (template.paddingLeftMm / rollMm) * 100)}%` }}
                      title={`Left Margin: ${template.paddingLeftMm}mm`}
                    >
                      L
                    </div>
                    <div 
                      className="bg-indigo-600 text-white flex items-center justify-center transition-all duration-300 truncate px-1 text-center"
                      style={{ width: `${(template.printableWidthMm / rollMm) * 100}%` }}
                      title={`Active Printable Area: ${template.printableWidthMm}mm`}
                    >
                      Printable Area: {template.printableWidthMm}mm
                    </div>
                    <div 
                      className="bg-emerald-500 text-white flex items-center justify-center transition-all duration-300 truncate px-0.5"
                      style={{ width: `${Math.max(5, (template.paddingRightMm / rollMm) * 100)}%` }}
                      title={`Safe Right Buffer: ${template.paddingRightMm}mm`}
                    >
                      ✓ {template.paddingRightMm}mm
                    </div>
                    <div 
                      className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center transition-all duration-300 text-[8px]"
                      style={{ width: `${Math.max(3, (rightRollerMarginMm / rollMm) * 100)}%` }}
                      title={`Hardware Roller Clearance: ${rightRollerMarginMm.toFixed(1)}mm`}
                    >
                      Edge
                    </div>
                  </div>
                  <div className="flex justify-between text-3xs font-mono text-slate-400">
                    <span>0mm</span>
                    <span>Left: {template.paddingLeftMm}mm</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">Printable: {template.printableWidthMm}mm</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Safe Buffer: {template.paddingRightMm}mm</span>
                    <span>Roll: {template.paperWidth}</span>
                  </div>
                </div>

                <p className="text-3xs text-slate-500 dark:text-slate-400">
                  {isSafeMargin
                    ? '✓ Guaranteed zero digit cut-off: All amounts and rates will remain inside printable margins.'
                    : '⚠️ Your printable width is close to the paper roller boundary. If physical slips clip numbers, lower printable width by 2mm.'}
                </p>
              </div>

              {/* Paper Roll Width Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Paper Roll Size:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handlePaperWidthChange('80mm')}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                      template.paperWidth === '80mm'
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm">80mm (3-Inch)</span>
                      {template.paperWidth === '80mm' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <p className="text-3xs text-slate-500 mt-1">
                      Standard restaurant POS rolls. Printable span calibrated to 66mm with safe margins.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePaperWidthChange('58mm')}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                      template.paperWidth === '58mm'
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm">58mm (2-Inch)</span>
                      {template.paperWidth === '58mm' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <p className="text-3xs text-slate-500 mt-1">
                      Compact mobile / handheld thermal printers. Printable span calibrated to 46mm.
                    </p>
                  </button>
                </div>
              </div>

              {/* Printable Width Slider */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>Printable Line Width:</span>
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-2xs">
                      {template.printableWidthMm} mm
                    </span>
                  </label>
                  <div className="flex items-center gap-1">
                    {(is58 ? [42, 44, 46, 48] : [62, 64, 66, 68, 70]).map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => updateField('printableWidthMm', val)}
                        className={`px-1.5 py-0.5 rounded text-3xs font-mono font-bold cursor-pointer transition-all ${
                          template.printableWidthMm === val
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {val}mm
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="range"
                  min={is58 ? 40 : 56}
                  max={is58 ? 52 : 74}
                  step={1}
                  value={template.printableWidthMm}
                  onChange={e => updateField('printableWidthMm', Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <p className="text-3xs text-slate-500">
                  💡 Watch the preview right column expand or contract live as you drag this slider. Recommended: {is58 ? '44mm - 46mm' : '64mm - 68mm'}.
                </p>
              </div>

              {/* Safe Right Margin Offset Slider */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>Safe Right Margin Buffer:</span>
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-2xs">
                      {template.paddingRightMm} mm
                    </span>
                  </label>
                  <div className="flex items-center gap-1">
                    {[1.0, 2.0, 2.5, 3.5, 4.5].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => updateField('paddingRightMm', val)}
                        className={`px-1.5 py-0.5 rounded text-3xs font-mono font-bold cursor-pointer transition-all ${
                          template.paddingRightMm === val
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {val}mm
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={6}
                  step={0.5}
                  value={template.paddingRightMm}
                  onChange={e => updateField('paddingRightMm', Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <p className="text-3xs text-slate-500">
                  Adds an interior safety gap so the last digits of rates and grand totals have guaranteed clearance from the cutter.
                </p>
              </div>

              {/* Left Margin Slider */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>Left Margin Buffer:</span>
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-2xs">
                      {template.paddingLeftMm} mm
                    </span>
                  </label>
                  <div className="flex items-center gap-1">
                    {[0.5, 1.0, 1.5, 2.0, 3.0].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => updateField('paddingLeftMm', val)}
                        className={`px-1.5 py-0.5 rounded text-3xs font-mono font-bold cursor-pointer transition-all ${
                          template.paddingLeftMm === val
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {val}mm
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={4}
                  step={0.5}
                  value={template.paddingLeftMm}
                  onChange={e => updateField('paddingLeftMm', Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 2: STYLING & LINING */}
          {activeTab === 'styling' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-5">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Type className="w-4 h-4 text-indigo-600" />
                  <span>Typography, Scale &amp; Divider Styles</span>
                </h3>
                <p className="text-2xs text-slate-500 mt-1">
                  Adjust font sizes, line spacing, and horizontal divider designs. All changes immediately update live in the specimen box below and the thermal roll preview.
                </p>
              </div>

              {/* LIVE TYPOGRAPHY & DIVIDER SPECIMEN CARD */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Live Typography &amp; Line Specimen</span>
                  </span>
                  <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 uppercase">
                    {template.fontFamily} • {template.fontSizeScale} • {template.lineSpacing}
                  </span>
                </div>

                {/* Specimen Box */}
                <div 
                  className={`p-3 rounded-xl bg-white text-black border border-slate-300 shadow-sm transition-all duration-200 ${fontFamilyClass} ${fontScaleClass.base} ${lineSpacingClass.leading}`}
                >
                  <div className="flex justify-between items-center font-bold">
                    <span>Steamed Momo (10 pcs)</span>
                    <span>2 × 280.00 = 560.00</span>
                  </div>
                  <div className={`text-[8.5px] text-slate-600 italic`}>
                    + House timur dip (Extra spicy)
                  </div>
                  
                  {renderSingleDivider()}

                  <div className="flex justify-between items-center font-black">
                    <span className={fontScaleClass.title}>GRAND TOTAL:</span>
                    <span className={`${fontScaleClass.title} text-indigo-700`}>Rs. 1,243.00</span>
                  </div>
                </div>
              </div>

              {/* Font Size Scale */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Font Size Scale:
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                  {(['compact', 'normal', 'large'] as const).map(scale => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => updateField('fontSizeScale', scale)}
                      className={`py-2 px-3 rounded-xl border text-center capitalize transition-all cursor-pointer ${
                        template.fontSizeScale === scale
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-2xs font-black'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div>{scale === 'compact' ? 'Compact' : scale === 'normal' ? 'Normal' : 'Large'}</div>
                      <div className="text-3xs font-mono font-normal opacity-70">
                        {scale === 'compact' ? '8.5px base' : scale === 'normal' ? '10px base' : '11.5px base'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family Selection */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Font Family:
                </label>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => updateField('fontFamily', 'sans')}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      template.fontFamily === 'sans'
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-bold font-sans">Clean Sans-Serif</div>
                    <div className="text-3xs text-slate-500 font-sans mt-0.5">High sharpness on modern 203 DPI thermal heads.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateField('fontFamily', 'mono')}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      template.fontFamily === 'mono'
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-bold font-mono">Monospaced POS Matrix</div>
                    <div className="text-3xs text-slate-500 font-mono mt-0.5">Classic fixed-pitch cash register alignment.</div>
                  </button>
                </div>
              </div>

              {/* Line Spacing / Density */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Line Height &amp; Vertical Density:
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                  {(['tight', 'normal', 'relaxed'] as const).map(density => (
                    <button
                      key={density}
                      type="button"
                      onClick={() => updateField('lineSpacing', density)}
                      className={`py-2 px-3 rounded-xl border text-center capitalize transition-all cursor-pointer ${
                        template.lineSpacing === density
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-2xs font-black'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div>{density === 'tight' ? 'Tight' : density === 'normal' ? 'Normal' : 'Relaxed'}</div>
                      <div className="text-3xs font-mono font-normal opacity-70">
                        {density === 'tight' ? 'Paper Saver' : density === 'normal' ? 'Balanced' : 'Spacious'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Horizontal Divider Line Style */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Divider Line Style:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
                  {[
                    { id: 'dashed', label: 'Dashed', borderClass: 'border-dashed border-t-2' },
                    { id: 'dotted', label: 'Dotted', borderClass: 'border-dotted border-t-2' },
                    { id: 'solid', label: 'Solid Line', borderClass: 'border-solid border-t-2' },
                    { id: 'double', label: 'Double Line', borderClass: 'border-double border-t-4' }
                  ].map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => updateField('dividerStyle', d.id as ReceiptDividerStyle)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between gap-2 ${
                        template.dividerStyle === d.id
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-2xs font-black'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{d.label}</span>
                      <div className={`w-full ${d.borderClass} border-slate-700 dark:border-slate-300 my-1`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ITEM COLUMNS */}
          {activeTab === 'columns' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-5">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Layout className="w-4 h-4 text-indigo-600" />
                  <span>Item Table Column Configuration</span>
                </h3>
                <p className="text-2xs text-slate-500 mt-1">
                  Customize header titles and column visibility. Hiding the Rate column gives maximum width to dish names on narrow 58mm rolls.
                </p>
              </div>

              {/* Show Rate Column Toggle */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Include Unit Rate Column
                  </h4>
                  <p className="text-3xs text-slate-500 mt-0.5">
                    {cols.showRate 
                      ? 'Displaying 4 columns: ITEM | QTY | RATE | TOTAL' 
                      : 'Displaying 3 columns: ITEM | QTY | TOTAL (Ideal for compact paper)'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cols.showRate}
                    onChange={e => {
                      isDirtyRef.current = true;
                      setHasUnsavedChanges(true);
                      const show = e.target.checked;
                      if (show) {
                        setTemplate(prev => ({
                          ...prev,
                          columns: {
                            ...prev.columns,
                            showRate: true,
                            itemColWidthPercent: is58 ? 48 : 46,
                            qtyColWidthPercent: 14,
                            rateColWidthPercent: is58 ? 16 : 18,
                            amtColWidthPercent: 22
                          }
                        }));
                      } else {
                        setTemplate(prev => ({
                          ...prev,
                          columns: {
                            ...prev.columns,
                            showRate: false,
                            itemColWidthPercent: is58 ? 56 : 56,
                            qtyColWidthPercent: 16,
                            rateColWidthPercent: 0,
                            amtColWidthPercent: 28
                          }
                        }));
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Column Header Label Customization */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Custom Column Header Titles:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-3xs text-slate-400 font-bold">Item Column:</span>
                    <input
                      type="text"
                      value={cols.itemHeaderLabel}
                      onChange={e => updateColumn('itemHeaderLabel', e.target.value)}
                      placeholder="ITEM"
                      className="w-full mt-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold uppercase"
                    />
                  </div>
                  <div>
                    <span className="text-3xs text-slate-400 font-bold">Qty Column:</span>
                    <input
                      type="text"
                      value={cols.qtyHeaderLabel}
                      onChange={e => updateColumn('qtyHeaderLabel', e.target.value)}
                      placeholder="QTY"
                      className="w-full mt-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold uppercase"
                    />
                  </div>
                  {cols.showRate && (
                    <div>
                      <span className="text-3xs text-slate-400 font-bold">Rate Column:</span>
                      <input
                        type="text"
                        value={cols.rateHeaderLabel}
                        onChange={e => updateColumn('rateHeaderLabel', e.target.value)}
                        placeholder="RATE"
                        className="w-full mt-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold uppercase"
                      />
                    </div>
                  )}
                  <div>
                    <span className="text-3xs text-slate-400 font-bold">Total Column:</span>
                    <input
                      type="text"
                      value={cols.amtHeaderLabel}
                      onChange={e => updateColumn('amtHeaderLabel', e.target.value)}
                      placeholder="TOTAL"
                      className="w-full mt-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Column Width Distribution Info */}
              <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-3xs text-slate-600 dark:text-slate-400 space-y-1">
                <div className="font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Right Margin Truncation Protection Active</span>
                </div>
                <p>
                  Column numbers are strictly right-aligned with an automatic 3px safety margin padding. Even multi-digit amounts like Rs. 99,999.00 will never overflow off the paper edge.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: ADD / REMOVE SECTIONS */}
          {activeTab === 'sections' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-5">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-indigo-600" />
                  <span>Add / Remove Receipt Sections</span>
                </h3>
                <p className="text-2xs text-slate-500 mt-1">
                  Easily toggle which elements appear on your customer receipts and tax invoices.
                </p>
              </div>

              {/* Header Elements */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Header &amp; Restaurant Info</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'showStoreName', label: 'Restaurant Name' },
                    { key: 'showTagline', label: 'Tagline / Slogan' },
                    { key: 'showAddress', label: 'Street Address & Ward' },
                    { key: 'showPhone', label: 'Telephone / Mobile' },
                    { key: 'showPanVat', label: 'PAN / VAT Number' },
                    { key: 'showInvoiceTitle', label: 'Tax Invoice Title' }
                  ].map(sec => (
                    <label key={sec.key} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{sec.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(template[sec.key as keyof ReceiptTemplateConfig])}
                        onChange={e => updateField(sec.key as keyof ReceiptTemplateConfig, e.target.checked as any)}
                        className="rounded accent-indigo-600 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Invoice Title Custom Text Input */}
              {template.showInvoiceTitle && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-1">
                  <label className="text-2xs font-bold text-slate-700 dark:text-slate-300">
                    Custom Invoice Title Text:
                  </label>
                  <input
                    type="text"
                    value={template.invoiceCustomTitle || ''}
                    onChange={e => updateField('invoiceCustomTitle', e.target.value)}
                    placeholder="TAX INVOICE"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold uppercase"
                  />
                </div>
              )}

              {/* Order & Customer Metadata */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Order &amp; Server Info</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'showTableBadge', label: 'Table Number Badge' },
                    { key: 'showServerName', label: 'Cashier / Server Name' },
                    { key: 'showDateTime', label: 'Date & Time Stamp' },
                    { key: 'showCustomerInfo', label: 'Customer Name & PAN' },
                    { key: 'showItemModifiers', label: 'Item Modifiers & Notes' },
                    { key: 'showSpecialNotes', label: 'Order / Kitchen Special Notes' }
                  ].map(sec => (
                    <label key={sec.key} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{sec.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(template[sec.key as keyof ReceiptTemplateConfig])}
                        onChange={e => updateField(sec.key as keyof ReceiptTemplateConfig, e.target.checked as any)}
                        className="rounded accent-indigo-600 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Tax & Totals Section */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Tax &amp; Payment Breakdown</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'showSubtotal', label: 'Subtotal Row' },
                    { key: 'showDiscount', label: 'Discount Row' },
                    { key: 'showTaxableAmount', label: 'Taxable Base Amount' },
                    { key: 'showVatBreakdown', label: '13% Nepal VAT Row' },
                    { key: 'showGrandTotalHighlight', label: 'Grand Total Highlight Box' },
                    { key: 'showPaymentMethod', label: 'Payment Tendered' },
                    { key: 'showChangeDue', label: 'Change / Due Balance' }
                  ].map(sec => (
                    <label key={sec.key} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{sec.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(template[sec.key as keyof ReceiptTemplateConfig])}
                        onChange={e => updateField(sec.key as keyof ReceiptTemplateConfig, e.target.checked as any)}
                        className="rounded accent-indigo-600 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Footer & QR */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Footer, QR &amp; Branding</h4>
                
                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Fonepay / IRD QR Code Box</span>
                  <input
                    type="checkbox"
                    checked={template.showQrCode}
                    onChange={e => updateField('showQrCode', e.target.checked)}
                    className="rounded accent-indigo-600 cursor-pointer"
                  />
                </label>

                {template.showQrCode && (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-1">
                    <label className="text-2xs font-bold text-slate-700 dark:text-slate-300">
                      QR Code Label Text:
                    </label>
                    <input
                      type="text"
                      value={template.qrCodeLabel || ''}
                      onChange={e => updateField('qrCodeLabel', e.target.value)}
                      placeholder="SCAN TO PAY (FONEPAY / IRD)"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-2xs font-bold text-slate-700 dark:text-slate-300">
                      Footer Message / Greeting:
                    </label>
                    <input
                      type="checkbox"
                      checked={template.showFooterMessage}
                      onChange={e => updateField('showFooterMessage', e.target.checked)}
                      className="rounded accent-indigo-600 cursor-pointer"
                    />
                  </div>
                  {template.showFooterMessage && (
                    <textarea
                      rows={2}
                      value={template.customFooterMessage || ''}
                      onChange={e => updateField('customFooterMessage', e.target.value)}
                      placeholder="Thank you for dining with us! Visit again."
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                    <span className="font-bold text-slate-700 dark:text-slate-300">QuickIMS POS Tag</span>
                    <input
                      type="checkbox"
                      checked={template.showQuickimsBranding}
                      onChange={e => updateField('showQuickimsBranding', e.target.checked)}
                      className="rounded accent-indigo-600 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Tear Marker Line</span>
                    <input
                      type="checkbox"
                      checked={template.showCutLine}
                      onChange={e => updateField('showCutLine', e.target.checked)}
                      className="rounded accent-indigo-600 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* EXPLICIT SAVE CHANGES BAR */}
          {(() => {
            const activeEditing = editingSavedTemplateId
              ? savedTemplates.find(t => t.id === editingSavedTemplateId)
              : undefined;
            return (
              <div className={`bg-white dark:bg-slate-900 border rounded-3xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                hasUnsavedChanges
                  ? 'border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20'
                  : 'border-slate-200 dark:border-slate-800'
              }`}>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-slate-100">
                    {hasUnsavedChanges ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span>You have unsaved layout changes</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>All layout changes saved</span>
                      </>
                    )}
                  </div>
                  <p className="text-3xs text-slate-500 dark:text-slate-400">
                    {activeEditing
                      ? `Updating saved template "${activeEditing.name}" (${TARGET_META[activeEditing.target].shortLabel})`
                      : `Saving applies to: ${TARGET_META[editingScope].label}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {hasUnsavedChanges && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isSavingChanges}
                      onClick={handleDiscardChanges}
                    >
                      Discard
                    </Button>
                  )}
                  {canUpdateLayout ? (
                    <Button
                      variant="primary-arrow"
                      size="sm"
                      disabled={isSavingChanges}
                      onClick={() => void handleSaveChanges()}
                      icon={<Save className="w-4 h-4" />}
                    >
                      {isSavingChanges ? 'Saving...' : 'Save Changes'}
                    </Button>
                  ) : (
                    <span className="text-3xs font-bold text-slate-400 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                      Read-Only Mode
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* RIGHT COLUMN: REALISTIC THERMAL PAPER SLIP SIMULATOR (5 COLS) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4 sticky top-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-indigo-600" />
              <span>Real-Time Thermal Preview</span>
            </h3>

            <div className="flex items-center gap-1.5">
              <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Safe: {template.paddingRightMm}mm
              </span>
              <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {template.paperWidth} ({template.printableWidthMm}mm)
              </span>
            </div>
          </div>

          {/* Slip Type Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-2xs font-bold">
            <button
              type="button"
              onClick={() => setPreviewSlipType('bill')}
              className={`py-1.5 px-1 text-center rounded-xl transition-all cursor-pointer ${
                previewSlipType === 'bill'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Tax Bill
            </button>
            <button
              type="button"
              onClick={() => setPreviewSlipType('kot')}
              className={`py-1.5 px-1 text-center rounded-xl transition-all cursor-pointer ${
                previewSlipType === 'kot'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Kitchen KOT
            </button>
            <button
              type="button"
              onClick={() => setPreviewSlipType('bot')}
              className={`py-1.5 px-1 text-center rounded-xl transition-all cursor-pointer ${
                previewSlipType === 'bot'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Bar BOT
            </button>
            <button
              type="button"
              onClick={() => setPreviewSlipType('test')}
              className={`py-1.5 px-1 text-center rounded-xl transition-all cursor-pointer ${
                previewSlipType === 'test'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Test Slip
            </button>
          </div>

          {/* REALISTIC THERMAL PAPER CONTAINER */}
          <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-3xl flex flex-col items-center justify-center overflow-x-auto min-h-[480px]">
            
            {/* Visual Ruler indicator with dynamic mm labels */}
            <div 
              className="mb-2 flex items-center justify-between text-[8px] font-mono text-slate-500 dark:text-slate-400 px-1 border-b border-dashed border-slate-300 dark:border-slate-700 transition-all duration-300"
              style={{ width: `${rollWidthPx}px` }}
            >
              <span>| 0mm</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">Printable: {template.printableWidthMm}mm</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Safe: {template.paddingRightMm}mm ✓</span>
              <span>{template.paperWidth} |</span>
            </div>

            {/* Paper Roll Simulation */}
            <div 
              className="bg-white text-black p-0 shadow-2xl border-x-2 border-slate-300 transition-all duration-300 relative select-none overflow-hidden"
              style={{
                width: `${rollWidthPx}px`,
                borderTop: '4px dashed #94a3b8',
                borderBottom: '4px dashed #94a3b8',
                boxShadow: '0 12px 28px -6px rgba(0, 0, 0, 0.25), 0 8px 12px -6px rgba(0, 0, 0, 0.2)'
              }}
            >
              {/* Safe Zone Visual Guide Overlay on Right Edge */}
              <div 
                className="absolute top-0 bottom-0 right-0 bg-emerald-500/10 border-l border-dashed border-emerald-500/40 pointer-events-none transition-all duration-300 z-10 flex items-center justify-center"
                style={{ width: `${Math.max(10, rightBufferPx)}px` }}
                title={`Safe Right Buffer: ${template.paddingRightMm}mm clearance from physical paper edge`}
              >
                <span className="text-[7px] text-emerald-700 font-mono rotate-90 whitespace-nowrap opacity-60 font-bold">
                  SAFE {template.paddingRightMm}mm
                </span>
              </div>

              {/* Dynamic Printable Slip Body */}
              <div
                className={`transition-all duration-300 ${fontFamilyClass} ${fontScaleClass.base} ${lineSpacingClass.leading}`}
                style={{
                  width: `${printableWidthPx}px`,
                  paddingLeft: `${Math.max(6, leftPaddingPx)}px`,
                  paddingRight: `${Math.max(8, rightBufferPx)}px`,
                  paddingTop: '12px',
                  paddingBottom: '16px'
                }}
              >
                {/* 1. CUSTOMER TAX BILL PREVIEW */}
                {previewSlipType === 'bill' && (
                  <div className={lineSpacingClass.space}>
                    <div className="text-center">
                      {template.showStoreName && (
                        <div className={`font-black uppercase tracking-tight ${fontScaleClass.title}`}>
                          {settings.companyName || 'QuickIMS Restaurant'}
                        </div>
                      )}
                      {template.showTagline && settings.tagline && (
                        <div className={`${fontScaleClass.badge} font-bold text-slate-700`}>{settings.tagline}</div>
                      )}
                      {template.showAddress && (() => {
                        const addr = [settings.address?.street, settings.address?.municipality, settings.address?.district].filter(Boolean).join(', ');
                        return addr ? <div className={fontScaleClass.small}>{addr}</div> : null;
                      })()}
                      {template.showPhone && (settings.phone || settings.mobile) && (
                        <div className={fontScaleClass.small}>Tel: {[settings.phone, settings.mobile].filter(Boolean).join(' / ')}</div>
                      )}
                      {template.showPanVat && (
                        <div className={`${fontScaleClass.small} font-bold`}>PAN/VAT: <strong>{settings.panNumber || settings.vatNumber || '601234567'}</strong></div>
                      )}
                      {template.showInvoiceTitle && (
                        <div className={`font-black mt-1 tracking-wider uppercase ${fontScaleClass.heading}`}>
                          {template.invoiceCustomTitle || 'TAX INVOICE'}
                        </div>
                      )}
                    </div>
                    
                    {renderSingleDivider()}
                    
                    <div className={`flex justify-between ${fontScaleClass.small}`}>
                      <span>Inv: <strong>INV-2082-0492</strong></span>
                      {template.showTableBadge && <span>Table: <strong>M-01</strong></span>}
                    </div>
                    <div className={`flex justify-between ${fontScaleClass.small}`}>
                      {template.showDateTime ? <span>Date: 2026-03-24</span> : <span />}
                      {template.showServerName && <span>Cashier: Counter Cashier</span>}
                    </div>
                    {template.showCustomerInfo && (
                      <div className={`flex justify-between ${fontScaleClass.small}`}>
                        <span>Guest: Table Guest</span>
                        <span>PAN: 302918274</span>
                      </div>
                    )}

                    {renderDivider('single')}

                    {/* Dynamic Items Table */}
                    <table className={`w-full table-fixed ${fontScaleClass.base}`}>
                      <thead>
                        <tr className="border-b border-black font-bold uppercase text-[9px]">
                          <th className="text-left py-0.5" style={{ width: `${cols.itemColWidthPercent}%` }}>{cols.itemHeaderLabel}</th>
                          <th className="text-center py-0.5" style={{ width: `${cols.qtyColWidthPercent}%` }}>{cols.qtyHeaderLabel}</th>
                          {cols.showRate && (
                            <th className="text-right py-0.5" style={{ width: `${cols.rateColWidthPercent}%` }}>{cols.rateHeaderLabel}</th>
                          )}
                          <th className="text-right py-0.5" style={{ width: `${cols.showRate ? cols.amtColWidthPercent : (cols.amtColWidthPercent + cols.rateColWidthPercent)}%` }}>{cols.amtHeaderLabel}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dotted divide-slate-300">
                        <tr>
                          <td className={`text-left ${lineSpacingClass.tablePadding} font-bold`}>Steamed Momo</td>
                          <td className="text-center">2</td>
                          {cols.showRate && <td className="text-right">280.00</td>}
                          <td className="text-right font-bold pr-0.5">560.00</td>
                        </tr>
                        <tr>
                          <td className={`text-left ${lineSpacingClass.tablePadding} font-bold`}>Craft Beer 650ml</td>
                          <td className="text-center">1</td>
                          {cols.showRate && <td className="text-right">450.00</td>}
                          <td className="text-right font-bold pr-0.5">450.00</td>
                        </tr>
                        <tr>
                          <td className={`text-left ${lineSpacingClass.tablePadding} font-bold`}>Mineral Water 1L</td>
                          <td className="text-center">3</td>
                          {cols.showRate && <td className="text-right">45.00</td>}
                          <td className="text-right font-bold pr-0.5">135.00</td>
                        </tr>
                      </tbody>
                    </table>

                    {renderDivider('single')}

                    {/* Totals Section */}
                    <div className={`space-y-0.5 ${fontScaleClass.small}`}>
                      {template.showSubtotal && (
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span className="font-bold">1145.00</span>
                        </div>
                      )}
                      {template.showDiscount && (
                        <div className="flex justify-between">
                          <span>Discount:</span>
                          <span>-45.00</span>
                        </div>
                      )}
                      {template.showTaxableAmount && (
                        <div className="flex justify-between">
                          <span>Taxable Base:</span>
                          <span>1100.00</span>
                        </div>
                      )}
                      {template.showVatBreakdown && (
                        <div className="flex justify-between">
                          <span>VAT (13% Inc):</span>
                          <span>143.00</span>
                        </div>
                      )}

                      {template.showGrandTotalHighlight ? (
                        <div className={`border-y-2 border-black py-1 my-1 flex justify-between font-black ${fontScaleClass.heading}`}>
                          <span>GRAND TOTAL:</span>
                          <span className="pr-0.5">Rs. 1,243.00</span>
                        </div>
                      ) : (
                        <div className={`border-t border-dashed border-black pt-1 flex justify-between font-bold ${fontScaleClass.heading}`}>
                          <span>TOTAL:</span>
                          <span className="pr-0.5">Rs. 1,243.00</span>
                        </div>
                      )}

                      {template.showPaymentMethod && (
                        <div className="flex justify-between pt-0.5">
                          <span>Payment: CASH</span>
                          <span>Paid: 1,300.00</span>
                        </div>
                      )}
                      {template.showChangeDue && (
                        <div className="flex justify-between font-bold">
                          <span>Change Due:</span>
                          <span>Rs. 57.00</span>
                        </div>
                      )}
                    </div>

                    {template.showQrCode && (
                      <div className="border-2 border-black p-1.5 text-center text-[8px] font-black my-2 max-w-[130px] mx-auto">
                        <QrCode className="w-6 h-6 mx-auto mb-0.5 text-black" />
                        <span>{template.qrCodeLabel || 'SCAN TO PAY'}</span>
                      </div>
                    )}

                    {template.showFooterMessage && (
                      <div className={`text-center font-bold pt-1 ${fontScaleClass.badge}`}>
                        {template.customFooterMessage || 'Thank you for dining with us! Visit again.'}
                      </div>
                    )}

                    {template.showQuickimsBranding && (
                      <div className="text-center text-[7.5px] text-slate-500">
                        QuickIMS Nepal POS
                      </div>
                    )}

                    {template.showCutLine && renderDivider('cut')}
                  </div>
                )}

                {/* 2. KITCHEN KOT PREVIEW */}
                {previewSlipType === 'kot' && (
                  <div className={lineSpacingClass.space}>
                    {template.showStoreName && (
                      <div className={`text-center font-bold uppercase ${fontScaleClass.small}`}>
                        {settings.companyName || 'QuickIMS Restaurant'}
                      </div>
                    )}
                    <div className={`text-center font-black uppercase tracking-wider ${fontScaleClass.title}`}>
                      *** KITCHEN ORDER TICKET ***
                    </div>
                    {template.showTableBadge && (
                      <>
                        <div className="text-center my-1">
                          <span className={`inline-block border-2 border-black font-black px-2 py-0.5 ${fontScaleClass.heading}`}>
                            TABLE: M-01
                          </span>
                        </div>
                        <div className={`text-center font-bold text-slate-700 ${fontScaleClass.small}`}>
                          Main Dining Hall • Guests: 4
                        </div>
                      </>
                    )}
                    {renderSingleDivider()}
                    <div className={`flex justify-between ${fontScaleClass.small}`}>
                      <span>KOT #: <strong>KOT-0082</strong></span>
                      {template.showServerName && <span>Server: <strong>Floor Server</strong></span>}
                    </div>
                    <div className={`flex justify-between ${fontScaleClass.small}`}>
                      <span>Station: <strong>KITCHEN (KDS)</strong></span>
                      {template.showDateTime && <span>12:45 PM</span>}
                    </div>
                    {renderDivider('single')}
                    
                    <div className={`font-bold flex justify-between uppercase ${fontScaleClass.small}`}>
                      <span>QTY &amp; DISH</span>
                      <span>STATUS</span>
                    </div>
                    {renderSingleDivider()}

                    <div className="space-y-2">
                      <div>
                        <div className="font-bold">2× Steamed Momo (10 pcs)</div>
                        {template.showItemModifiers && (
                          <div className="text-[9px] pl-3 italic text-slate-700">+ House Timur Dip</div>
                        )}
                        {template.showItemModifiers && (
                          <div className="text-[9px] pl-3 font-bold text-black">⚠️ Extra spicy timur dip</div>
                        )}
                      </div>
                      <div>
                        <div className="font-bold">1× House Special Fried Chicken</div>
                        {template.showItemModifiers && (
                          <div className="text-[9px] pl-3 italic text-slate-700">Crispy skin, chef garnish</div>
                        )}
                      </div>
                    </div>

                    {template.showSpecialNotes && (
                      <>
                        {renderSingleDivider()}
                        <div className={`font-bold ${fontScaleClass.small}`}>
                          NOTE: Please expedite starter dishes first!
                        </div>
                      </>
                    )}
                    {template.showFooterMessage && (
                      <>
                        {renderDivider('double')}
                        <div className={`text-center font-bold ${fontScaleClass.small}`}>
                          DISPATCH DISHES IMMEDIATELY
                        </div>
                      </>
                    )}
                    {template.showCutLine && renderDivider('cut')}
                  </div>
                )}

                {/* 3. BAR BOT PREVIEW */}
                {previewSlipType === 'bot' && (
                  <div className={lineSpacingClass.space}>
                    {template.showStoreName && (
                      <div className={`text-center font-bold uppercase ${fontScaleClass.small}`}>
                        {settings.companyName || 'QuickIMS Restaurant'}
                      </div>
                    )}
                    <div className={`text-center font-black uppercase tracking-wider ${fontScaleClass.title}`}>
                      *** BAR ORDER TICKET (BOT) ***
                    </div>
                    {template.showTableBadge && (
                      <>
                        <div className="text-center my-1">
                          <span className={`inline-block border-2 border-black font-black px-2 py-0.5 ${fontScaleClass.heading}`}>
                            TABLE: M-01
                          </span>
                        </div>
                        <div className={`text-center font-bold text-slate-700 ${fontScaleClass.small}`}>
                          Bar / Dining • Guests: 4
                        </div>
                      </>
                    )}
                    {renderSingleDivider()}
                    <div className={`flex justify-between ${fontScaleClass.small}`}>
                      <span>BOT #: <strong>BOT-0014</strong></span>
                      {template.showServerName && <span>Server: <strong>Floor Server</strong></span>}
                    </div>
                    <div className={`flex justify-between ${fontScaleClass.small}`}>
                      <span>Station: <strong>BAR DISPENSE</strong></span>
                      {template.showDateTime && <span>12:45 PM</span>}
                    </div>
                    {renderDivider('single')}
                    
                    <div className={`font-bold uppercase ${fontScaleClass.small}`}>
                      BEVERAGE &amp; DISPENSE ITEMS
                    </div>
                    {renderSingleDivider()}

                    <div className="space-y-2">
                      <div>
                        <div className="font-bold">2× Craft Draught Beer 650ml</div>
                        {template.showItemModifiers && (
                          <div className="text-[9px] pl-3 italic text-slate-700">Chilled bottle with lime</div>
                        )}
                      </div>
                      <div>
                        <div className="font-bold">1× Classic Virgin Mojito Mint</div>
                        {template.showItemModifiers && (
                          <div className="text-[9px] pl-3 italic text-slate-700">Less ice, fresh crushed mint</div>
                        )}
                      </div>
                    </div>

                    {template.showSpecialNotes && (
                      <>
                        {renderSingleDivider()}
                        <div className={`font-bold ${fontScaleClass.small}`}>
                          BAR NOTE: Serve with chilled beer glasses
                        </div>
                      </>
                    )}
                    {template.showFooterMessage && (
                      <>
                        {renderDivider('double')}
                        <div className={`text-center font-bold ${fontScaleClass.small}`}>
                          DISPENSE CHILLED TO RUNNER
                        </div>
                      </>
                    )}
                    {template.showCutLine && renderDivider('cut')}
                  </div>
                )}

                {/* 4. HARDWARE ALIGNMENT TEST SLIP PREVIEW */}
                {previewSlipType === 'test' && (
                  <div className={lineSpacingClass.space}>
                    <div className="text-center">
                      <div className={`font-black uppercase ${fontScaleClass.title}`}>*** PRINTER TEST SLIP ***</div>
                      <div className={`font-bold ${fontScaleClass.heading}`}>{targetPrinter.name}</div>
                      <div className={fontScaleClass.small}>Roll: <strong>{template.paperWidth}</strong> | Width: <strong>{template.printableWidthMm}mm</strong></div>
                      <div className={`font-bold text-emerald-800 ${fontScaleClass.small}`}>Safe Right Margin: {template.paddingRightMm}mm (Zero Cutoff)</div>
                    </div>
                    
                    {renderSingleDivider()}
                    <div className={`flex justify-between ${fontScaleClass.small}`}>
                      <span>Device: {targetPrinter.id}</span>
                      <span>Status: ONLINE ✓</span>
                    </div>
                    <div className={`flex justify-between ${fontScaleClass.small}`}>
                      <span>Alignment: VERIFIED</span>
                      <span>12:00:00</span>
                    </div>

                    {renderDivider('single')}
                    <div className={`text-center font-bold uppercase ${fontScaleClass.small}`}>COLUMN &amp; NUMBER ALIGNMENT</div>
                    {renderSingleDivider()}

                    <table className={`w-full table-fixed ${fontScaleClass.base}`}>
                      <thead>
                        <tr className="border-b border-black font-bold uppercase text-[9px]">
                          <th className="text-left py-0.5" style={{ width: `${cols.itemColWidthPercent}%` }}>{cols.itemHeaderLabel}</th>
                          <th className="text-center py-0.5" style={{ width: `${cols.qtyColWidthPercent}%` }}>{cols.qtyHeaderLabel}</th>
                          {cols.showRate && (
                            <th className="text-right py-0.5" style={{ width: `${cols.rateColWidthPercent}%` }}>{cols.rateHeaderLabel}</th>
                          )}
                          <th className="text-right py-0.5" style={{ width: `${cols.showRate ? cols.amtColWidthPercent : (cols.amtColWidthPercent + cols.rateColWidthPercent)}%` }}>{cols.amtHeaderLabel}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className={`text-left ${lineSpacingClass.tablePadding} font-bold`}>Steamed Momo</td>
                          <td className="text-center">2</td>
                          {cols.showRate && <td className="text-right">280.00</td>}
                          <td className="text-right font-bold pr-0.5">560.00</td>
                        </tr>
                        <tr>
                          <td className={`text-left ${lineSpacingClass.tablePadding} font-bold`}>Craft Beer</td>
                          <td className="text-center">1</td>
                          {cols.showRate && <td className="text-right">450.00</td>}
                          <td className="text-right font-bold pr-0.5">450.00</td>
                        </tr>
                        <tr>
                          <td className={`text-left ${lineSpacingClass.tablePadding} font-bold`}>Mineral Water</td>
                          <td className="text-center">3</td>
                          {cols.showRate && <td className="text-right">45.00</td>}
                          <td className="text-right font-bold pr-0.5">135.00</td>
                        </tr>
                      </tbody>
                    </table>

                    {renderDivider('single')}
                    <div className={`space-y-0.5 ${fontScaleClass.small}`}>
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-bold">1145.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>VAT (13%):</span>
                        <span>148.85</span>
                      </div>
                      <div className={`border-y-2 border-black py-1 my-1 flex justify-between font-black ${fontScaleClass.heading}`}>
                        <span>TEST TOTAL:</span>
                        <span className="pr-0.5">Rs. 1293.85</span>
                      </div>
                    </div>

                    {renderSingleDivider()}
                    <div className={`text-center font-bold ${fontScaleClass.small}`}>SAFE PAPER WIDTH BOUNDARY TEST</div>
                    <div className="text-center text-[8px] font-mono tracking-tighter truncate opacity-70">
                      |&lt;--1234567890123456789012345678901234567890--&gt;|
                    </div>
                    <div className="text-center text-[8px] text-emerald-800 font-bold">
                      ✓ Numbers fully inside paper margin (No Clipping)
                    </div>
                    {renderDivider('double')}
                    <div className={`text-center font-bold ${fontScaleClass.small}`}>
                      ✓ PRINTER HARDWARE TEST SUCCESSFUL!
                    </div>
                    {renderDivider('cut')}
                  </div>
                )}
              </div>
            </div>

            {/* Quick action button under preview */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <Button
                variant="primary-arrow"
                size="sm"
                disabled={isTestPrinting}
                onClick={handlePrintTestSlip}
                icon={<Printer className="w-3.5 h-3.5" />}
              >
                {isTestPrinting ? 'Printing Test...' : 'Print Preview on Hardware'}
              </Button>
            </div>
          </div>
        </div>

      </div>

      {/* SAVE / EDIT REUSABLE TEMPLATE MODAL */}
      {templateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <BookmarkPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                    {templateModal.mode === 'create' ? 'Save Reusable Print Template' : 'Edit Saved Template'}
                  </h3>
                  <p className="text-3xs text-slate-500">
                    Give this layout a clear name and choose which operation uses it.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTemplateModal(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-2xs font-bold text-slate-700 dark:text-slate-300">
                  Template Name *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={templateModal.name}
                  onChange={e => setTemplateModal(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="e.g. Main Counter 80mm Bill, Fast Kitchen KOT"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-bold text-slate-700 dark:text-slate-300">
                  What Is This Template For? *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['bill', 'kot', 'bot', 'all'] as ReceiptTemplateTarget[]).map(target => (
                    <button
                      key={target}
                      type="button"
                      onClick={() => setTemplateModal(prev => prev ? { ...prev, target } : null)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        templateModal.target === target
                          ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200'
                          : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-xs font-black">{TARGET_META[target].label}</div>
                      <div className="text-3xs text-slate-500 mt-0.5">{TARGET_META[target].hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-bold text-slate-700 dark:text-slate-300">
                  Short Note / Description (Optional)
                </label>
                <input
                  type="text"
                  value={templateModal.description}
                  onChange={e => setTemplateModal(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="e.g. Compact 58mm roll without QR & discount rows"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              {templateModal.mode === 'edit' && (
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Update template layout with current editor settings ({template.paperWidth})
                  </span>
                  <input
                    type="checkbox"
                    checked={templateModal.applyCurrentLayout}
                    onChange={e => setTemplateModal(prev => prev ? { ...prev, applyCurrentLayout: e.target.checked } : null)}
                    className="rounded accent-indigo-600 cursor-pointer"
                  />
                </label>
              )}

              <label className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 cursor-pointer text-xs">
                <div>
                  <div className="font-bold text-emerald-900 dark:text-emerald-200">
                    Use Immediately (Set as Active)
                  </div>
                  <div className="text-3xs text-emerald-700 dark:text-emerald-400">
                    Start printing {TARGET_META[templateModal.target].label} with this template right away.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={templateModal.activateNow}
                  onChange={e => setTemplateModal(prev => prev ? { ...prev, activateNow: e.target.checked } : null)}
                  className="rounded accent-emerald-600 cursor-pointer"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="secondary" size="sm" onClick={() => setTemplateModal(null)}>
                Cancel
              </Button>
              <Button
                variant="primary-arrow"
                size="sm"
                onClick={() => void handleConfirmTemplateModal()}
                icon={<Save className="w-3.5 h-3.5" />}
              >
                {templateModal.mode === 'create' ? 'Save Template' : 'Update Template'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
