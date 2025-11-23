import { useState, useRef, useCallback } from 'react';
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
  Copy, Eye, EyeOff, Lock, Unlock, Undo, Redo, FileJson
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { QRCodeSVG } from 'qrcode.react';

interface LabelField {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: boolean;
  fontSize: number;
  fontWeight: 'normal' | 'bold' | 'semibold';
  fontFamily: string;
  color: string;
  backgroundColor: string;
  textAlign: 'left' | 'center' | 'right';
  rotation: number;
  borderWidth: number;
  borderColor: string;
  padding: number;
  locked: boolean;
  zIndex: number;
  codeType?: 'barcode' | 'qrcode';
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
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
}

const AVAILABLE_FIELDS = [
  { id: 'company_name', name: 'Company Name', defaultValue: 'R. K. INTERLINING' },
  { id: 'item_name', name: 'Item Name', defaultValue: '2565' },
  { id: 'item_code', name: 'Item Code', defaultValue: '2565110' },
  { id: 'length', name: 'Length', defaultValue: '65 meter' },
  { id: 'width', name: 'Width', defaultValue: '40"' },
  { id: 'color', name: 'Color', defaultValue: 'Normal White' },
  { id: 'quality', name: 'Quality', defaultValue: 'Normal Hard' },
  { id: 'weight', name: 'Weight', defaultValue: '2.5kg' },
  { id: 'serial_no', name: 'Serial Number', defaultValue: '01-M1-041025-00152-0119' },
  { id: 'barcode', name: 'Barcode', defaultValue: '00054321:2770:001234:1.25' },
  { id: 'qrcode', name: 'QR Code', defaultValue: '00054321:2770:001234:1.25' },
];

const FONT_FAMILIES = [
  'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Comic Sans MS', 'Trebuchet MS', 'Impact'
];

const LABEL_TEMPLATES = {
  product: {
    name: 'Product Label',
    config: { label_width_mm: 100, label_height_mm: 60, orientation: 'landscape' as const },
    fields: [
      { x: 10, y: 10, width: 180, height: 25, fontSize: 16, enabled: true, fontWeight: 'bold' as const, id: 'company_name' },
      { x: 10, y: 45, width: 180, height: 20, fontSize: 12, enabled: true, fontWeight: 'semibold' as const, id: 'item_name' },
      { x: 10, y: 70, width: 180, height: 18, fontSize: 10, enabled: true, fontWeight: 'normal' as const, id: 'item_code' },
      { x: 10, y: 95, width: 85, height: 18, fontSize: 10, enabled: true, fontWeight: 'normal' as const, id: 'length' },
      { x: 105, y: 95, width: 85, height: 18, fontSize: 10, enabled: true, fontWeight: 'normal' as const, id: 'width' },
      { x: 10, y: 120, width: 85, height: 18, fontSize: 10, enabled: true, fontWeight: 'normal' as const, id: 'color' },
      { x: 105, y: 120, width: 85, height: 18, fontSize: 10, enabled: true, fontWeight: 'normal' as const, id: 'weight' },
      { x: 10, y: 145, width: 180, height: 18, fontSize: 9, enabled: true, fontWeight: 'normal' as const, id: 'serial_no' },
      { x: 10, y: 170, width: 180, height: 50, fontSize: 8, enabled: true, fontWeight: 'normal' as const, id: 'barcode', codeType: 'barcode' as const },
    ],
  },
  shipping: {
    name: 'Shipping Label',
    config: { label_width_mm: 100, label_height_mm: 80, orientation: 'portrait' as const },
    fields: [
      { x: 10, y: 10, width: 180, height: 25, fontSize: 14, enabled: true, fontWeight: 'bold' as const, id: 'company_name' },
      { x: 10, y: 45, width: 180, height: 20, fontSize: 12, enabled: true, fontWeight: 'normal' as const, id: 'item_code' },
      { x: 10, y: 120, width: 180, height: 20, fontSize: 11, enabled: true, fontWeight: 'normal' as const, id: 'weight' },
      { x: 10, y: 150, width: 180, height: 20, fontSize: 10, enabled: true, fontWeight: 'normal' as const, id: 'serial_no' },
      { x: 10, y: 180, width: 80, height: 80, fontSize: 8, enabled: true, fontWeight: 'normal' as const, id: 'qrcode', codeType: 'qrcode' as const },
    ],
  },
  minimal: {
    name: 'Minimal Label',
    config: { label_width_mm: 80, label_height_mm: 40, orientation: 'landscape' as const },
    fields: [
      { x: 10, y: 10, width: 140, height: 20, fontSize: 12, enabled: true, fontWeight: 'bold' as const, id: 'item_code' },
      { x: 10, y: 35, width: 140, height: 40, fontSize: 8, enabled: true, fontWeight: 'normal' as const, id: 'barcode', codeType: 'barcode' as const },
    ],
  },
};

const LabelCustomizationTool = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<{ fields: LabelField[], config: LabelConfiguration }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const [config, setConfig] = useState<LabelConfiguration>({
    company_name: '',
    logo_url: '',
    label_width_mm: 100,
    label_height_mm: 60,
    orientation: 'landscape',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#000000',
    showGrid: false,
    snapToGrid: false,
    gridSize: 10,
  });

  const [fields, setFields] = useState<LabelField[]>(
    AVAILABLE_FIELDS.map((field, index) => ({
      id: field.id,
      name: field.name,
      x: 10,
      y: 10 + (index * 25),
      width: field.id === 'qrcode' ? 80 : 180,
      height: field.id === 'qrcode' ? 80 : 20,
      enabled: index < 5,
      fontSize: 12,
      fontWeight: 'normal',
      fontFamily: 'Arial',
      color: '#000000',
      backgroundColor: 'transparent',
      textAlign: 'left',
      rotation: 0,
      borderWidth: 0,
      borderColor: '#000000',
      padding: 2,
      locked: false,
      zIndex: index,
      codeType: field.id === 'barcode' ? 'barcode' : field.id === 'qrcode' ? 'qrcode' : undefined,
    }))
  );

  const saveToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ fields: JSON.parse(JSON.stringify(fields)), config: JSON.parse(JSON.stringify(config)) });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [fields, config, history, historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setFields(JSON.parse(JSON.stringify(prevState.fields)));
      setConfig(JSON.parse(JSON.stringify(prevState.config)));
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setFields(JSON.parse(JSON.stringify(nextState.fields)));
      setConfig(JSON.parse(JSON.stringify(nextState.config)));
      setHistoryIndex(historyIndex + 1);
    }
  };

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
        const loadedConfig = {
          company_name: data.company_name || '',
          logo_url: data.logo_url || '',
          label_width_mm: Number(data.label_width_mm),
          label_height_mm: Number(data.label_height_mm),
          orientation: data.orientation as 'landscape' | 'portrait',
          backgroundColor: '#ffffff',
          borderWidth: 1,
          borderColor: '#000000',
          showGrid: false,
          snapToGrid: false,
          gridSize: 10,
        };
        setConfig(loadedConfig);
        
        if (data.fields_config && Array.isArray(data.fields_config)) {
          setFields(data.fields_config as unknown as LabelField[]);
        }
      }
      
      return data;
    },
  });

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
      toast({ title: 'Logo uploaded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error uploading logo', description: error.message, variant: 'destructive' });
    },
  });

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
      toast({ title: 'Configuration saved successfully' });
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

  const handleDragStart = (fieldId: string, e: React.DragEvent) => {
    const field = fields.find(f => f.id === fieldId);
    if (field?.locked) {
      e.preventDefault();
      return;
    }
    setDraggingField(fieldId);
    setSelectedField(fieldId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggingField) return;

    const rect = e.currentTarget.getBoundingClientRect();
    let x = (e.clientX - rect.left) / zoom;
    let y = (e.clientY - rect.top) / zoom;

    if (config.snapToGrid) {
      x = Math.round(x / config.gridSize) * config.gridSize;
      y = Math.round(y / config.gridSize) * config.gridSize;
    }

    setFields(fields.map(field => 
      field.id === draggingField ? { ...field, x, y } : field
    ));
    setDraggingField(null);
    saveToHistory();
  };

  const handleTemplateSelect = (templateKey: string) => {
    if (templateKey === 'custom') return;
    
    const template = LABEL_TEMPLATES[templateKey as keyof typeof LABEL_TEMPLATES];
    if (!template) return;

    setConfig({ ...config, ...template.config });
    
    const newFields = template.fields.map((tf, index) => {
      const baseField = AVAILABLE_FIELDS.find(f => f.id === tf.id);
      return {
        id: tf.id,
        name: baseField?.name || tf.id,
        ...tf,
        fontFamily: 'Arial',
        color: '#000000',
        backgroundColor: 'transparent',
        textAlign: 'left' as const,
        rotation: 0,
        borderWidth: 0,
        borderColor: '#000000',
        padding: 2,
        locked: false,
        zIndex: index,
        codeType: ('codeType' in tf) ? tf.codeType : undefined,
      };
    });
    
    setFields(newFields);
    saveToHistory();
    toast({ title: 'Template applied', description: `${template.name} loaded successfully` });
  };

  const updateField = (fieldId: string, updates: Partial<LabelField>) => {
    setFields(fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
  };

  const duplicateField = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    
    const newField = { 
      ...field, 
      id: `${field.id}_${Date.now()}`,
      x: field.x + 20, 
      y: field.y + 20,
      zIndex: Math.max(...fields.map(f => f.zIndex)) + 1,
    };
    setFields([...fields, newField]);
    saveToHistory();
    toast({ title: 'Field duplicated' });
  };

  const deleteField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
    if (selectedField === fieldId) setSelectedField(null);
    saveToHistory();
    toast({ title: 'Field deleted' });
  };

  const exportConfiguration = () => {
    const exportData = { config, fields };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'label-config.json';
    a.click();
    toast({ title: 'Configuration exported' });
  };

  const importConfiguration = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        setConfig(data.config);
        setFields(data.fields);
        saveToHistory();
        toast({ title: 'Configuration imported successfully' });
      } catch (error) {
        toast({ title: 'Invalid configuration file', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
  };

  const labelScale = config.orientation === 'landscape' 
    ? 500 / config.label_width_mm 
    : 400 / config.label_width_mm;

  const selectedFieldData = fields.find(f => f.id === selectedField);

  const getFieldValue = (fieldId: string) => {
    return AVAILABLE_FIELDS.find(f => f.id === fieldId)?.defaultValue || fieldId;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Label Customization Tool</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={undo} disabled={historyIndex <= 0}>
                <Undo className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1}>
                <Redo className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={exportConfiguration}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Label htmlFor="import-config" className="cursor-pointer">
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <FileJson className="h-4 w-4 mr-2" />
                    Import
                  </span>
                </Button>
              </Label>
              <input
                id="import-config"
                type="file"
                accept=".json"
                onChange={importConfiguration}
                className="hidden"
              />
              <Button onClick={() => saveConfigMutation.mutate()} disabled={saveConfigMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="styling">Styling</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="template">Quick Templates</Label>
                <Select onValueChange={handleTemplateSelect}>
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom Configuration</SelectItem>
                    <SelectItem value="product">Product Label (100x60mm)</SelectItem>
                    <SelectItem value="shipping">Shipping Label (100x80mm)</SelectItem>
                    <SelectItem value="minimal">Minimal Label (80x40mm)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={config.company_name}
                    onChange={(e) => setConfig({ ...config, company_name: e.target.value })}
                    placeholder="Enter company name"
                  />
                </div>

                <div>
                  <Label>Company Logo</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadLogoMutation.isPending}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadLogoMutation.isPending ? 'Uploading...' : 'Upload'}
                    </Button>
                    {config.logo_url && (
                      <img src={config.logo_url} alt="Logo" className="h-10 w-auto border rounded" />
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="label_width">Width (mm)</Label>
                  <Input
                    id="label_width"
                    type="number"
                    min="10"
                    max="300"
                    value={config.label_width_mm}
                    onChange={(e) => setConfig({ ...config, label_width_mm: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <Label htmlFor="label_height">Height (mm)</Label>
                  <Input
                    id="label_height"
                    type="number"
                    min="10"
                    max="300"
                    value={config.label_height_mm}
                    onChange={(e) => setConfig({ ...config, label_height_mm: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <Label htmlFor="orientation">Orientation</Label>
                  <Select
                    value={config.orientation}
                    onValueChange={(value: 'landscape' | 'portrait') => 
                      setConfig({ ...config, orientation: value })
                    }
                  >
                    <SelectTrigger id="orientation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="landscape">Landscape</SelectItem>
                      <SelectItem value="portrait">Portrait</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-grid"
                    checked={config.showGrid}
                    onCheckedChange={(checked) => setConfig({ ...config, showGrid: checked })}
                  />
                  <Label htmlFor="show-grid" className="cursor-pointer">Show Grid</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="snap-grid"
                    checked={config.snapToGrid}
                    onCheckedChange={(checked) => setConfig({ ...config, snapToGrid: checked })}
                  />
                  <Label htmlFor="snap-grid" className="cursor-pointer">Snap to Grid</Label>
                </div>

                <div>
                  <Label htmlFor="grid-size">Grid Size</Label>
                  <Input
                    id="grid-size"
                    type="number"
                    min="5"
                    max="50"
                    value={config.gridSize}
                    onChange={(e) => setConfig({ ...config, gridSize: Number(e.target.value) })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="fields" className="space-y-4 mt-4">
              <div className="space-y-2">
                {fields.map((field) => (
                  <Card key={field.id} className={selectedField === field.id ? 'border-primary' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateField(field.id, { enabled: !field.enabled })}
                          >
                            {field.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateField(field.id, { locked: !field.locked })}
                          >
                            {field.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                          </Button>
                          <span className="font-medium">{field.name}</span>
                          <Badge variant={field.enabled ? 'default' : 'secondary'}>
                            {field.enabled ? 'Visible' : 'Hidden'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedField(field.id)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => duplicateField(field.id)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteField(field.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {selectedField === field.id && (
                        <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4">
                          <div>
                            <Label>Position X</Label>
                            <Input
                              type="number"
                              value={field.x}
                              onChange={(e) => updateField(field.id, { x: Number(e.target.value) })}
                            />
                          </div>
                          <div>
                            <Label>Position Y</Label>
                            <Input
                              type="number"
                              value={field.y}
                              onChange={(e) => updateField(field.id, { y: Number(e.target.value) })}
                            />
                          </div>
                          <div>
                            <Label>Width</Label>
                            <Input
                              type="number"
                              value={field.width}
                              onChange={(e) => updateField(field.id, { width: Number(e.target.value) })}
                            />
                          </div>
                          <div>
                            <Label>Height</Label>
                            <Input
                              type="number"
                              value={field.height}
                              onChange={(e) => updateField(field.id, { height: Number(e.target.value) })}
                            />
                          </div>
                          <div>
                            <Label>Font Size</Label>
                            <Slider
                              value={[field.fontSize]}
                              onValueChange={([value]) => updateField(field.id, { fontSize: value })}
                              min={8}
                              max={32}
                              step={1}
                            />
                            <span className="text-xs text-muted-foreground">{field.fontSize}px</span>
                          </div>
                          <div>
                            <Label>Font Weight</Label>
                            <Select
                              value={field.fontWeight}
                              onValueChange={(value: 'normal' | 'bold' | 'semibold') => 
                                updateField(field.id, { fontWeight: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="semibold">Semi Bold</SelectItem>
                                <SelectItem value="bold">Bold</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Font Family</Label>
                            <Select
                              value={field.fontFamily}
                              onValueChange={(value) => updateField(field.id, { fontFamily: value })}
                            >
                              <SelectTrigger>
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
                            <Label>Text Align</Label>
                            <div className="flex gap-2">
                              <Button
                                variant={field.textAlign === 'left' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => updateField(field.id, { textAlign: 'left' })}
                              >
                                <AlignLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                variant={field.textAlign === 'center' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => updateField(field.id, { textAlign: 'center' })}
                              >
                                <AlignCenter className="h-4 w-4" />
                              </Button>
                              <Button
                                variant={field.textAlign === 'right' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => updateField(field.id, { textAlign: 'right' })}
                              >
                                <AlignRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div>
                            <Label>Text Color</Label>
                            <Input
                              type="color"
                              value={field.color}
                              onChange={(e) => updateField(field.id, { color: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Background</Label>
                            <Input
                              type="color"
                              value={field.backgroundColor}
                              onChange={(e) => updateField(field.id, { backgroundColor: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Rotation</Label>
                            <Slider
                              value={[field.rotation]}
                              onValueChange={([value]) => updateField(field.id, { rotation: value })}
                              min={0}
                              max={360}
                              step={15}
                            />
                            <span className="text-xs text-muted-foreground">{field.rotation}°</span>
                          </div>
                           <div>
                             <Label>Border Width</Label>
                             <Slider
                               value={[field.borderWidth]}
                               onValueChange={([value]) => updateField(field.id, { borderWidth: value })}
                               min={0}
                               max={5}
                               step={1}
                             />
                             <span className="text-xs text-muted-foreground">{field.borderWidth}px</span>
                           </div>
                           {(field.id === 'barcode' || field.id === 'qrcode' || field.codeType) && (
                             <div className="col-span-2">
                               <Label>Code Type</Label>
                               <Select
                                 value={field.codeType || (field.id === 'barcode' ? 'barcode' : 'qrcode')}
                                 onValueChange={(value: 'barcode' | 'qrcode') => 
                                   updateField(field.id, { codeType: value })
                                 }
                               >
                                 <SelectTrigger>
                                   <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent>
                                   <SelectItem value="barcode">Barcode</SelectItem>
                                   <SelectItem value="qrcode">QR Code</SelectItem>
                                 </SelectContent>
                               </Select>
                             </div>
                           )}
                         </div>
                       )}
                     </CardContent>
                   </Card>
                 ))}
               </div>
             </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Label>Zoom</Label>
                    <Button variant="outline" size="sm" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium w-16 text-center">{Math.round(zoom * 100)}%</span>
                    <Button variant="outline" size="sm" onClick={() => setZoom(Math.min(2, zoom + 0.25))}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setConfig({ ...config, showGrid: !config.showGrid })}>
                    <Grid3x3 className="h-4 w-4 mr-2" />
                    {config.showGrid ? 'Hide' : 'Show'} Grid
                  </Button>
                </div>

                <div className="overflow-auto border rounded-lg p-8" style={{ backgroundColor: '#f5f5f5' }}>
                  <div
                    className="relative mx-auto"
                    style={{
                      width: `${config.label_width_mm * labelScale * zoom}px`,
                      height: `${config.label_height_mm * labelScale * zoom}px`,
                      backgroundColor: config.backgroundColor,
                      border: `${config.borderWidth}px solid ${config.borderColor}`,
                      backgroundImage: config.showGrid
                        ? `repeating-linear-gradient(0deg, #e0e0e0 0px, #e0e0e0 1px, transparent 1px, transparent ${config.gridSize * zoom}px),
                           repeating-linear-gradient(90deg, #e0e0e0 0px, #e0e0e0 1px, transparent 1px, transparent ${config.gridSize * zoom}px)`
                        : 'none',
                    }}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    {/* Logo */}
                    {config.logo_url && (
                      <div
                        className="absolute"
                        style={{
                          top: `${5 * zoom}px`,
                          left: `${5 * zoom}px`,
                          transform: `scale(${zoom})`,
                          transformOrigin: 'top left',
                        }}
                      >
                        <img src={config.logo_url} alt="Logo" style={{ height: '30px', width: 'auto' }} />
                      </div>
                    )}

                    {/* Fields */}
                    {fields.filter(f => f.enabled).map((field) => (
                      <div
                        key={field.id}
                        draggable={!field.locked}
                        onDragStart={(e) => handleDragStart(field.id, e)}
                        onClick={() => setSelectedField(field.id)}
                        className={`absolute cursor-move ${selectedField === field.id ? 'ring-2 ring-primary' : ''} ${field.locked ? 'cursor-not-allowed opacity-75' : ''}`}
                        style={{
                          left: `${field.x * zoom}px`,
                          top: `${field.y * zoom}px`,
                          width: `${field.width * zoom}px`,
                          height: `${field.height * zoom}px`,
                          fontSize: `${field.fontSize * zoom}px`,
                          fontWeight: field.fontWeight === 'bold' ? 700 : field.fontWeight === 'semibold' ? 600 : 400,
                          fontFamily: field.fontFamily,
                          color: field.color,
                          backgroundColor: field.backgroundColor,
                          textAlign: field.textAlign,
                          transform: `rotate(${field.rotation}deg)`,
                          border: `${field.borderWidth}px solid ${field.borderColor}`,
                          padding: `${field.padding * zoom}px`,
                          display: 'flex',
                          alignItems: 'center',
                          zIndex: field.zIndex,
                          overflow: 'hidden',
                          wordBreak: 'break-word',
                        }}
                       >
                         {(field.codeType === 'qrcode' || field.id === 'qrcode') ? (
                           <div className="flex flex-col items-center justify-center w-full h-full">
                             <QRCodeSVG 
                               value={getFieldValue(field.id)} 
                               size={Math.min(field.width, field.height) * zoom * 0.9}
                               level="M"
                               includeMargin={false}
                             />
                           </div>
                         ) : (field.codeType === 'barcode' || field.id === 'barcode') ? (
                           <div className="flex flex-col items-center w-full">
                             <div className="text-[10px] mb-1">{getFieldValue(field.id)}</div>
                             <div className="flex gap-0.5">
                               {Array.from({ length: 30 }).map((_, i) => (
                                 <div
                                   key={i}
                                   className="bg-black"
                                   style={{ 
                                     width: `${1 * zoom}px`, 
                                     height: i % 3 === 0 ? `${20 * zoom}px` : `${16 * zoom}px` 
                                   }}
                                 />
                               ))}
                             </div>
                           </div>
                         ) : (
                           <span className="w-full">{getFieldValue(field.id)}</span>
                         )}
                       </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="styling" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Label Background Color</Label>
                  <Input
                    type="color"
                    value={config.backgroundColor}
                    onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Label Border Color</Label>
                  <Input
                    type="color"
                    value={config.borderColor}
                    onChange={(e) => setConfig({ ...config, borderColor: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Border Width</Label>
                  <Slider
                    value={[config.borderWidth]}
                    onValueChange={([value]) => setConfig({ ...config, borderWidth: value })}
                    min={0}
                    max={10}
                    step={1}
                  />
                  <span className="text-xs text-muted-foreground">{config.borderWidth}px</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Selected Field: {selectedFieldData?.name || 'None'}</Label>
                {selectedFieldData && (
                  <div className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateField(selectedFieldData.id, { rotation: (selectedFieldData.rotation - 15) % 360 })}
                      >
                        <RotateCw className="h-4 w-4 transform -scale-x-100" />
                      </Button>
                      <span className="text-sm">Rotate: {selectedFieldData.rotation}°</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateField(selectedFieldData.id, { rotation: (selectedFieldData.rotation + 15) % 360 })}
                      >
                        <RotateCw className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Padding</Label>
                        <Slider
                          value={[selectedFieldData.padding]}
                          onValueChange={([value]) => updateField(selectedFieldData.id, { padding: value })}
                          min={0}
                          max={20}
                          step={1}
                        />
                        <span className="text-xs text-muted-foreground">{selectedFieldData.padding}px</span>
                      </div>
                      <div>
                        <Label>Z-Index</Label>
                        <Input
                          type="number"
                          value={selectedFieldData.zIndex}
                          onChange={(e) => updateField(selectedFieldData.id, { zIndex: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default LabelCustomizationTool;
