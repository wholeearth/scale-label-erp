import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, Save, Download, Grid3x3, ZoomIn, ZoomOut, 
  RotateCw, AlignLeft, AlignCenter, AlignRight, Trash2,
  Copy, Eye, EyeOff, Lock, Unlock, Undo, Redo, Plus,
  Layers, Move, Type, Maximize2, Image as ImageIcon, Barcode
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';

interface LabelField {
  id: string;
  name: string;
  type: 'text' | 'barcode' | 'qrcode' | 'logo';
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: boolean;
  fontSize: number;
  fontWeight: 'normal' | 'bold' | '600' | '700' | '800';
  fontFamily: string;
  color: string;
  backgroundColor: string;
  textAlign: 'left' | 'center' | 'right';
  rotation: number;
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
  padding: number;
  locked: boolean;
  zIndex: number;
  visible: boolean;
  opacity: number;
}

interface LabelConfiguration {
  company_name: string;
  logo_url: string;
  label_width_mm: number;
  label_height_mm: number;
  orientation: 'landscape' | 'portrait';
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
}

const FIELD_TEMPLATES = [
  { id: 'company_name', name: 'Company Name', type: 'text' as const, defaultValue: 'R. K. INTERLINING' },
  { id: 'item_name', name: 'Item Name', type: 'text' as const, defaultValue: '2565' },
  { id: 'item_code', name: 'Item Code', type: 'text' as const, defaultValue: '2565110' },
  { id: 'length', name: 'Length', type: 'text' as const, defaultValue: '65 meter' },
  { id: 'width', name: 'Width', type: 'text' as const, defaultValue: '40"' },
  { id: 'color', name: 'Color', type: 'text' as const, defaultValue: 'Normal White' },
  { id: 'quality', name: 'Quality', type: 'text' as const, defaultValue: 'Normal Hard' },
  { id: 'weight', name: 'Weight', type: 'text' as const, defaultValue: '2.5kg' },
  { id: 'serial_no', name: 'Serial Number', type: 'text' as const, defaultValue: '01-M1-041025-00152-0119' },
  { id: 'barcode', name: 'Barcode', type: 'barcode' as const, defaultValue: '00054321:2770:001234:1.25' },
  { id: 'qrcode', name: 'QR Code', type: 'qrcode' as const, defaultValue: '00054321:2770:001234:1.25' },
  { id: 'logo', name: 'Company Logo', type: 'logo' as const, defaultValue: '' },
];

const FONT_FAMILIES = [
  'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 
  'Georgia', 'Trebuchet MS', 'Impact', 'Roboto', 'Open Sans'
];

const LabelCustomizationTool = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [resizingField, setResizingField] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<{ fields: LabelField[], config: LabelConfiguration }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const barcodePreviewRef = useRef<HTMLCanvasElement>(null);
  
  // Sample production data for preview
  const previewData = {
    operatorCode: '01',
    machineCode: 'M1',
    date: new Date().toLocaleDateString('en-GB').split('/').join('').slice(0, 6),
    time: new Date().toTimeString().slice(0, 5).replace(':', ''),
    serialNumber: `01-M1-${new Date().toLocaleDateString('en-GB').split('/').join('').slice(0, 6)}-00152-${new Date().toTimeString().slice(0, 5).replace(':', '')}`,
    barcodeData: `00054321:2770:001234:${(Math.random() * 3 + 1).toFixed(2)}`,
    globalSerial: '00054321',
    itemCode: '2770',
    itemSerial: '001234',
    weight: (Math.random() * 3 + 1).toFixed(2),
    companyName: 'R. K. INTERLINING',
    itemName: 'Cotton Interlining',
    length: '65 meter',
    width: '40"',
    color: 'Normal White',
    quality: 'Normal Hard',
  };
  
  const [config, setConfig] = useState<LabelConfiguration>({
    company_name: '',
    logo_url: '',
    label_width_mm: 60,
    label_height_mm: 40,
    orientation: 'landscape',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 0,
    showGrid: true,
    snapToGrid: true,
    gridSize: 5,
  });

  const [fields, setFields] = useState<LabelField[]>([]);

  // Real-time subscription to label config changes
  useEffect(() => {
    const channel = supabase
      .channel('label-config-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'label_configurations',
        },
        (payload) => {
          console.log('Label config updated:', payload);
          queryClient.invalidateQueries({ queryKey: ['label-config'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const saveToHistory = useCallback(() => {
    const newState = { 
      fields: JSON.parse(JSON.stringify(fields)), 
      config: JSON.parse(JSON.stringify(config)) 
    };
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newState);
      if (newHistory.length > 50) newHistory.shift(); // Keep last 50 states
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [fields, config, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setFields(JSON.parse(JSON.stringify(prevState.fields)));
      setConfig(JSON.parse(JSON.stringify(prevState.config)));
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setFields(JSON.parse(JSON.stringify(nextState.fields)));
      setConfig(JSON.parse(JSON.stringify(nextState.config)));
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  // Load existing configuration
  const { data: existingConfig } = useQuery({
    queryKey: ['label-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('label_configurations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        const loadedConfig: LabelConfiguration = {
          company_name: data.company_name || '',
          logo_url: data.logo_url || '',
          label_width_mm: Number(data.label_width_mm),
          label_height_mm: Number(data.label_height_mm),
          orientation: data.orientation as 'landscape' | 'portrait',
          backgroundColor: '#ffffff',
          borderWidth: 2,
          borderColor: '#000000',
          borderRadius: 0,
          showGrid: true,
          snapToGrid: true,
          gridSize: 5,
        };
        setConfig(loadedConfig);
        
        if (data.fields_config && Array.isArray(data.fields_config)) {
          setFields(data.fields_config as unknown as LabelField[]);
        }
      }
      
      return data;
    },
  });

  // Upload logo
  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('label-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('label-logos')
        .getPublicUrl(filePath);

      return publicUrl;
    },
    onSuccess: (url) => {
      setConfig({ ...config, logo_url: url });
      saveToHistory();
      toast({ title: 'Logo uploaded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error uploading logo', description: error.message, variant: 'destructive' });
    },
  });

  // Save configuration
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const configData = {
        company_name: config.company_name,
        logo_url: config.logo_url,
        label_width_mm: config.label_width_mm,
        label_height_mm: config.label_height_mm,
        orientation: config.orientation,
        fields_config: JSON.parse(JSON.stringify(fields)),
      };

      if (existingConfig?.id) {
        const { error } = await supabase
          .from('label_configurations')
          .update(configData)
          .eq('id', existingConfig.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('label_configurations')
          .insert([configData]);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label-config'] });
      toast({ title: 'Configuration saved - synced to all operators', duration: 3000 });
    },
    onError: (error: Error) => {
      toast({ title: 'Error saving configuration', description: error.message, variant: 'destructive' });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadLogoMutation.mutate(file);
    }
  };

  const addField = (templateId: string) => {
    const template = FIELD_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    const newField: LabelField = {
      id: `${template.id}_${Date.now()}`,
      name: template.name,
      type: template.type,
      x: 10,
      y: 10,
      width: template.type === 'qrcode' ? 60 : template.type === 'barcode' ? 120 : template.type === 'logo' ? 80 : 100,
      height: template.type === 'qrcode' ? 60 : template.type === 'barcode' ? 40 : template.type === 'logo' ? 40 : 20,
      enabled: true,
      visible: true,
      fontSize: 12,
      fontWeight: 'normal',
      fontFamily: 'Arial',
      color: '#000000',
      backgroundColor: 'transparent',
      textAlign: 'left',
      rotation: 270,
      borderWidth: 0,
      borderColor: '#000000',
      borderRadius: 0,
      padding: 2,
      locked: false,
      zIndex: fields.length,
      opacity: 1,
    };

    setFields([...fields, newField]);
    setSelectedField(newField.id);
    saveToHistory();
  };

  const updateField = (id: string, updates: Partial<LabelField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    saveToHistory();
  };

  const deleteField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    if (selectedField === id) setSelectedField(null);
    saveToHistory();
  };

  const duplicateField = (id: string) => {
    const field = fields.find(f => f.id === id);
    if (!field) return;

    const newField: LabelField = {
      ...field,
      id: `${field.id}_copy_${Date.now()}`,
      x: field.x + 10,
      y: field.y + 10,
    };

    setFields([...fields, newField]);
    setSelectedField(newField.id);
    saveToHistory();
  };

  const handleMouseDown = (fieldId: string, e: React.MouseEvent) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field || field.locked) return;

    e.stopPropagation();
    setSelectedField(fieldId);

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDragOffset({
      x: e.clientX / zoom - field.x,
      y: e.clientY / zoom - field.y,
    });
    setDraggingField(fieldId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingField || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    let x = (e.clientX - rect.left) / zoom - dragOffset.x;
    let y = (e.clientY - rect.top) / zoom - dragOffset.y;

    if (config.snapToGrid) {
      x = Math.round(x / config.gridSize) * config.gridSize;
      y = Math.round(y / config.gridSize) * config.gridSize;
    }

    setFields(fields.map(f => 
      f.id === draggingField ? { ...f, x, y } : f
    ));
  };

  const handleMouseUp = () => {
    if (draggingField) {
      saveToHistory();
      setDraggingField(null);
    }
  };

  const exportConfig = () => {
    const exportData = { config, fields };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'label-config.json';
    a.click();
  };

  const importConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.config) setConfig(data.config);
        if (data.fields) setFields(data.fields);
        saveToHistory();
        toast({ title: 'Configuration imported successfully' });
      } catch (error) {
        toast({ title: 'Error importing configuration', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      const cmdOrCtrl = e.metaKey || e.ctrlKey;

      if (selectedField && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const field = fields.find(f => f.id === selectedField);
        if (!field || field.locked) return;

        const step = e.shiftKey ? 10 : 1;
        let updates: Partial<LabelField> = {};

        switch (e.key) {
          case 'ArrowUp': updates = { y: field.y - step }; break;
          case 'ArrowDown': updates = { y: field.y + step }; break;
          case 'ArrowLeft': updates = { x: field.x - step }; break;
          case 'ArrowRight': updates = { x: field.x + step }; break;
        }

        updateField(selectedField, updates);
      }

      if (selectedField && e.key === 'Delete') {
        e.preventDefault();
        deleteField(selectedField);
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedField(null);
      }

      if (cmdOrCtrl && e.key === 'd') {
        e.preventDefault();
        if (selectedField) duplicateField(selectedField);
      }

      if (cmdOrCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      if ((cmdOrCtrl && e.shiftKey && e.key === 'z') || (cmdOrCtrl && e.key === 'y')) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedField, fields, config, undo, redo]);

  const mmToPx = (mm: number) => mm * 3.7795275591; // Convert mm to pixels (96 DPI)

  const canvasWidth = mmToPx(config.label_width_mm);
  const canvasHeight = mmToPx(config.label_height_mm);

  const selectedFieldData = fields.find(f => f.id === selectedField);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Toolbar */}
      <div className="border-b bg-card p-2 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button onClick={() => saveConfigMutation.mutate()} size="sm" className="gap-2">
            <Save className="h-4 w-4" />
            Save & Sync
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button onClick={undo} disabled={historyIndex <= 0} size="sm" variant="outline">
            <Undo className="h-4 w-4" />
          </Button>
          <Button onClick={redo} disabled={historyIndex >= history.length - 1} size="sm" variant="outline">
            <Redo className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button onClick={exportConfig} size="sm" variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => document.getElementById('import-input')?.click()} size="sm" variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <input id="import-input" type="file" accept=".json" onChange={importConfig} className="hidden" />
          <Separator orientation="vertical" className="h-6" />
          <Button onClick={() => setIsPreviewing(!isPreviewing)} size="sm" variant={isPreviewing ? "default" : "outline"}>
            <Eye className="h-4 w-4 mr-2" />
            {isPreviewing ? 'Exit Preview' : 'Preview'}
          </Button>
        </div>
        
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <ZoomIn className="h-3 w-3" />
            {Math.round(zoom * 100)}%
          </Badge>
          <Button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} size="sm" variant="outline">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button onClick={() => setZoom(z => Math.min(3, z + 0.25))} size="sm" variant="outline">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Field Library */}
        <div className="w-64 border-r bg-card overflow-auto">
          <div className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Elements
            </h3>
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-2">
                {FIELD_TEMPLATES.map(template => (
                  <Button
                    key={template.id}
                    onClick={() => addField(template.id)}
                    variant="outline"
                    className="w-full justify-start gap-2"
                    size="sm"
                  >
                    {template.type === 'text' && <Type className="h-4 w-4" />}
                    {template.type === 'barcode' && <Barcode className="h-4 w-4" />}
                    {template.type === 'qrcode' && <Grid3x3 className="h-4 w-4" />}
                    {template.type === 'logo' && <ImageIcon className="h-4 w-4" />}
                    {template.name}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Center Canvas */}
        <div className="flex-1 overflow-auto bg-muted/30 p-8">
          <div className="flex items-center justify-center min-h-full">
            <div
              ref={canvasRef}
              className="relative bg-white shadow-2xl"
              style={{
                width: canvasWidth,
                height: canvasHeight,
                transform: `scale(${zoom})`,
                transformOrigin: 'center',
                border: `${config.borderWidth}px solid ${config.borderColor}`,
                borderRadius: config.borderRadius,
                backgroundColor: config.backgroundColor,
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Grid */}
              {config.showGrid && !isPreviewing && (
                <div className="absolute inset-0 pointer-events-none">
                  <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="grid" width={config.gridSize} height={config.gridSize} patternUnits="userSpaceOnUse">
                        <path d={`M ${config.gridSize} 0 L 0 0 0 ${config.gridSize}`} fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </svg>
                </div>
              )}

              {/* Fields */}
              {fields
                .filter(f => f.visible)
                .sort((a, b) => a.zIndex - b.zIndex)
                .map(field => (
                  <div
                    key={field.id}
                    className={`absolute cursor-move ${
                      selectedField === field.id && !isPreviewing
                        ? 'ring-2 ring-primary'
                        : ''
                    } ${field.locked ? 'cursor-not-allowed' : ''}`}
                    style={{
                      left: field.x,
                      top: field.y,
                      width: field.width,
                      height: field.height,
                      transform: `rotate(${field.rotation}deg)`,
                      transformOrigin: 'center',
                      opacity: field.opacity,
                    }}
                    onMouseDown={(e) => !isPreviewing && handleMouseDown(field.id, e)}
                  >
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{
                        fontSize: field.fontSize,
                        fontWeight: field.fontWeight,
                        fontFamily: field.fontFamily,
                        color: field.color,
                        backgroundColor: field.backgroundColor,
                        textAlign: field.textAlign,
                        border: `${field.borderWidth}px solid ${field.borderColor}`,
                        borderRadius: field.borderRadius,
                        padding: field.padding,
                      }}
                    >
                      {field.type === 'text' && !isPreviewing && (
                        <span className="truncate w-full">{field.name}</span>
                      )}
                      {field.type === 'text' && isPreviewing && (
                        <span className="truncate w-full" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {field.name === 'Company Name' ? previewData.companyName :
                           field.name === 'Item Name' ? previewData.itemName :
                           field.name === 'Item Code' ? previewData.itemCode :
                           field.name === 'Length' ? previewData.length :
                           field.name === 'Width' ? previewData.width :
                           field.name === 'Color' ? previewData.color :
                           field.name === 'Quality' ? previewData.quality :
                           field.name === 'Weight' ? `${previewData.weight}kg` :
                           field.name === 'Serial Number' ? previewData.serialNumber :
                           field.name}
                        </span>
                      )}
                      {field.type === 'barcode' && !isPreviewing && (
                        <div className="text-xs">Barcode</div>
                      )}
                      {field.type === 'barcode' && isPreviewing && (
                        <div className="flex flex-col items-center justify-center w-full h-full">
                          <canvas
                            ref={(el) => {
                              if (el) {
                                try {
                                  JsBarcode(el, previewData.barcodeData, {
                                    format: 'CODE128',
                                    width: 2,
                                    height: Math.max(field.height - 30, 30),
                                    displayValue: false,
                                    margin: 0,
                                  });
                                } catch (error) {
                                  console.error('Barcode generation error:', error);
                                }
                              }
                            }}
                            style={{ width: field.width - 4, height: field.height - 30 }}
                          />
                          <div className="text-xs mt-1" style={{ fontSize: Math.max(field.fontSize * 0.6, 8) }}>
                            {previewData.barcodeData}
                          </div>
                        </div>
                      )}
                      {field.type === 'qrcode' && !isPreviewing && (
                        <QRCodeSVG value="QR" size={Math.min(field.width, field.height) - 4} />
                      )}
                      {field.type === 'qrcode' && isPreviewing && (
                        <QRCodeSVG value={previewData.barcodeData} size={Math.min(field.width, field.height) - 4} />
                      )}
                      {field.type === 'logo' && config.logo_url && (
                        <img src={config.logo_url} alt="Logo" className="w-full h-full object-contain" />
                      )}
                      {field.type === 'logo' && !config.logo_url && (
                        <div className="text-xs text-muted-foreground">Logo</div>
                      )}
                    </div>
                    
                    {/* Selection handles */}
                    {selectedField === field.id && !isPreviewing && !field.locked && (
                      <>
                        <div className="absolute -top-1 -left-1 w-2 h-2 bg-primary rounded-full" />
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                        <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-primary rounded-full" />
                        <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                      </>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Properties */}
        <div className="w-80 border-l bg-card overflow-auto">
          <Tabs defaultValue="layers" className="h-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="layers">Layers</TabsTrigger>
              <TabsTrigger value="properties">Properties</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="layers" className="p-4 space-y-2">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Layers ({fields.length})
              </h3>
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="space-y-1">
                  {fields
                    .sort((a, b) => b.zIndex - a.zIndex)
                    .map(field => (
                      <div
                        key={field.id}
                        className={`p-2 rounded border cursor-pointer hover:bg-accent transition-colors ${
                          selectedField === field.id ? 'bg-accent border-primary' : 'border-border'
                        }`}
                        onClick={() => setSelectedField(field.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Move className="h-3 w-3 flex-shrink-0" />
                            <span className="text-sm truncate">{field.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateField(field.id, { visible: !field.visible });
                              }}
                            >
                              {field.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateField(field.id, { locked: !field.locked });
                              }}
                            >
                              {field.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicateField(field.id);
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteField(field.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="properties" className="p-4">
              {selectedFieldData ? (
                <ScrollArea className="h-[calc(100vh-200px)]">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs">Field Name</Label>
                      <Input
                        value={selectedFieldData.name}
                        onChange={(e) => updateField(selectedFieldData.id, { name: e.target.value })}
                        className="mt-1"
                      />
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">X Position</Label>
                        <Input
                          type="number"
                          value={selectedFieldData.x}
                          onChange={(e) => updateField(selectedFieldData.id, { x: Number(e.target.value) })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Y Position</Label>
                        <Input
                          type="number"
                          value={selectedFieldData.y}
                          onChange={(e) => updateField(selectedFieldData.id, { y: Number(e.target.value) })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Width</Label>
                        <Input
                          type="number"
                          value={selectedFieldData.width}
                          onChange={(e) => updateField(selectedFieldData.id, { width: Number(e.target.value) })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Height</Label>
                        <Input
                          type="number"
                          value={selectedFieldData.height}
                          onChange={(e) => updateField(selectedFieldData.id, { height: Number(e.target.value) })}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    {selectedFieldData.type === 'text' && (
                      <>
                        <Separator />
                        <div>
                          <Label className="text-xs">Font Size</Label>
                          <Slider
                            value={[selectedFieldData.fontSize]}
                            onValueChange={(v) => updateField(selectedFieldData.id, { fontSize: v[0] })}
                            min={8}
                            max={48}
                            step={1}
                            className="mt-2"
                          />
                          <span className="text-xs text-muted-foreground">{selectedFieldData.fontSize}px</span>
                        </div>

                        <div>
                          <Label className="text-xs">Font Family</Label>
                          <Select
                            value={selectedFieldData.fontFamily}
                            onValueChange={(v) => updateField(selectedFieldData.id, { fontFamily: v })}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FONT_FAMILIES.map(font => (
                                <SelectItem key={font} value={font}>{font}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs">Font Weight</Label>
                          <Select
                            value={selectedFieldData.fontWeight}
                            onValueChange={(v) => updateField(selectedFieldData.id, { fontWeight: v as any })}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="600">Semi Bold</SelectItem>
                              <SelectItem value="700">Bold</SelectItem>
                              <SelectItem value="800">Extra Bold</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs">Text Align</Label>
                          <div className="flex gap-1 mt-1">
                            <Button
                              size="sm"
                              variant={selectedFieldData.textAlign === 'left' ? 'default' : 'outline'}
                              onClick={() => updateField(selectedFieldData.id, { textAlign: 'left' })}
                            >
                              <AlignLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={selectedFieldData.textAlign === 'center' ? 'default' : 'outline'}
                              onClick={() => updateField(selectedFieldData.id, { textAlign: 'center' })}
                            >
                              <AlignCenter className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={selectedFieldData.textAlign === 'right' ? 'default' : 'outline'}
                              onClick={() => updateField(selectedFieldData.id, { textAlign: 'right' })}
                            >
                              <AlignRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Text Color</Label>
                          <Input
                            type="color"
                            value={selectedFieldData.color}
                            onChange={(e) => updateField(selectedFieldData.id, { color: e.target.value })}
                            className="mt-1 h-10"
                          />
                        </div>
                      </>
                    )}

                    <Separator />

                    <div>
                      <Label className="text-xs">Rotation</Label>
                      <Slider
                        value={[selectedFieldData.rotation]}
                        onValueChange={(v) => updateField(selectedFieldData.id, { rotation: v[0] })}
                        min={0}
                        max={360}
                        step={15}
                        className="mt-2"
                      />
                      <span className="text-xs text-muted-foreground">{selectedFieldData.rotation}°</span>
                    </div>

                    <div>
                      <Label className="text-xs">Opacity</Label>
                      <Slider
                        value={[selectedFieldData.opacity * 100]}
                        onValueChange={(v) => updateField(selectedFieldData.id, { opacity: v[0] / 100 })}
                        min={0}
                        max={100}
                        step={5}
                        className="mt-2"
                      />
                      <span className="text-xs text-muted-foreground">{Math.round(selectedFieldData.opacity * 100)}%</span>
                    </div>

                    <div>
                      <Label className="text-xs">Background Color</Label>
                      <Input
                        type="color"
                        value={selectedFieldData.backgroundColor === 'transparent' ? '#ffffff' : selectedFieldData.backgroundColor}
                        onChange={(e) => updateField(selectedFieldData.id, { backgroundColor: e.target.value })}
                        className="mt-1 h-10"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Border Width</Label>
                      <Slider
                        value={[selectedFieldData.borderWidth]}
                        onValueChange={(v) => updateField(selectedFieldData.id, { borderWidth: v[0] })}
                        min={0}
                        max={5}
                        step={1}
                        className="mt-2"
                      />
                      <span className="text-xs text-muted-foreground">{selectedFieldData.borderWidth}px</span>
                    </div>

                    {selectedFieldData.borderWidth > 0 && (
                      <div>
                        <Label className="text-xs">Border Color</Label>
                        <Input
                          type="color"
                          value={selectedFieldData.borderColor}
                          onChange={(e) => updateField(selectedFieldData.id, { borderColor: e.target.value })}
                          className="mt-1 h-10"
                        />
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Select a field to edit properties
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings" className="p-4">
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="space-y-4">
                  <div>
                    <Label>Company Name</Label>
                    <Input
                      value={config.company_name}
                      onChange={(e) => setConfig({ ...config, company_name: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Company Logo</Label>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      className="w-full mt-1"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {config.logo_url && (
                      <img src={config.logo_url} alt="Logo" className="mt-2 h-16 object-contain" />
                    )}
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Width (mm)</Label>
                      <Input
                        type="number"
                        value={config.label_width_mm}
                        onChange={(e) => setConfig({ ...config, label_width_mm: Number(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Height (mm)</Label>
                      <Input
                        type="number"
                        value={config.label_height_mm}
                        onChange={(e) => setConfig({ ...config, label_height_mm: Number(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <Label>Show Grid</Label>
                    <Switch
                      checked={config.showGrid}
                      onCheckedChange={(checked) => setConfig({ ...config, showGrid: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Snap to Grid</Label>
                    <Switch
                      checked={config.snapToGrid}
                      onCheckedChange={(checked) => setConfig({ ...config, snapToGrid: checked })}
                    />
                  </div>

                  {config.snapToGrid && (
                    <div>
                      <Label>Grid Size</Label>
                      <Input
                        type="number"
                        value={config.gridSize}
                        onChange={(e) => setConfig({ ...config, gridSize: Number(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default LabelCustomizationTool;
