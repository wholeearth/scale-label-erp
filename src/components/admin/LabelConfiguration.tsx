import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, Save, GripVertical } from 'lucide-react';

interface LabelField {
  id: string;
  name: string;
  x: number;
  y: number;
  enabled: boolean;
}

const AVAILABLE_FIELDS = [
  { id: 'company_name', name: 'Company Name' },
  { id: 'item_name', name: 'Item Name' },
  { id: 'item_code', name: 'Item Code' },
  { id: 'length', name: 'Length' },
  { id: 'width', name: 'Width' },
  { id: 'color', name: 'Color' },
  { id: 'quality', name: 'Quality' },
  { id: 'weight', name: 'Weight' },
  { id: 'serial_no', name: 'Serial Number' },
  { id: 'barcode', name: 'Barcode' },
];

const LABEL_TEMPLATES = {
  product: {
    name: 'Product Label',
    description: 'Standard product label with item details',
    config: {
      label_width_mm: 100,
      label_height_mm: 60,
      orientation: 'landscape' as const,
    },
    fields: [
      { id: 'company_name', name: 'Company Name', x: 10, y: 10, enabled: true },
      { id: 'item_name', name: 'Item Name', x: 10, y: 50, enabled: true },
      { id: 'item_code', name: 'Item Code', x: 10, y: 80, enabled: true },
      { id: 'length', name: 'Length', x: 10, y: 110, enabled: true },
      { id: 'width', name: 'Width', x: 10, y: 140, enabled: true },
      { id: 'color', name: 'Color', x: 10, y: 170, enabled: true },
      { id: 'quality', name: 'Quality', x: 10, y: 200, enabled: false },
      { id: 'weight', name: 'Weight', x: 10, y: 230, enabled: true },
      { id: 'serial_no', name: 'Serial Number', x: 10, y: 260, enabled: false },
      { id: 'barcode', name: 'Barcode', x: 10, y: 290, enabled: false },
    ],
  },
  shipping: {
    name: 'Shipping Label',
    description: 'Label optimized for shipping with serial and barcode',
    config: {
      label_width_mm: 100,
      label_height_mm: 80,
      orientation: 'portrait' as const,
    },
    fields: [
      { id: 'company_name', name: 'Company Name', x: 10, y: 10, enabled: true },
      { id: 'item_name', name: 'Item Name', x: 10, y: 50, enabled: true },
      { id: 'item_code', name: 'Item Code', x: 10, y: 80, enabled: true },
      { id: 'length', name: 'Length', x: 10, y: 110, enabled: false },
      { id: 'width', name: 'Width', x: 10, y: 140, enabled: false },
      { id: 'color', name: 'Color', x: 10, y: 170, enabled: false },
      { id: 'quality', name: 'Quality', x: 10, y: 200, enabled: false },
      { id: 'weight', name: 'Weight', x: 10, y: 230, enabled: true },
      { id: 'serial_no', name: 'Serial Number', x: 10, y: 260, enabled: true },
      { id: 'barcode', name: 'Barcode', x: 10, y: 290, enabled: true },
    ],
  },
  barcode: {
    name: 'Barcode Label',
    description: 'Minimal label with barcode focus',
    config: {
      label_width_mm: 80,
      label_height_mm: 40,
      orientation: 'landscape' as const,
    },
    fields: [
      { id: 'company_name', name: 'Company Name', x: 10, y: 10, enabled: false },
      { id: 'item_name', name: 'Item Name', x: 10, y: 50, enabled: false },
      { id: 'item_code', name: 'Item Code', x: 10, y: 80, enabled: true },
      { id: 'length', name: 'Length', x: 10, y: 110, enabled: false },
      { id: 'width', name: 'Width', x: 10, y: 140, enabled: false },
      { id: 'color', name: 'Color', x: 10, y: 170, enabled: false },
      { id: 'quality', name: 'Quality', x: 10, y: 200, enabled: false },
      { id: 'weight', name: 'Weight', x: 10, y: 230, enabled: false },
      { id: 'serial_no', name: 'Serial Number', x: 10, y: 260, enabled: true },
      { id: 'barcode', name: 'Barcode', x: 10, y: 290, enabled: true },
    ],
  },
};

const LabelConfiguration = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggingField, setDraggingField] = useState<string | null>(null);
  
  const [config, setConfig] = useState({
    company_name: '',
    logo_url: '',
    label_width_mm: 100,
    label_height_mm: 60,
    orientation: 'landscape' as 'landscape' | 'portrait',
  });

  const [fields, setFields] = useState<LabelField[]>(
    AVAILABLE_FIELDS.map((field, index) => ({
      ...field,
      x: 10,
      y: 10 + (index * 30),
      enabled: true,
    }))
  );

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
        setConfig({
          company_name: data.company_name || '',
          logo_url: data.logo_url || '',
          label_width_mm: Number(data.label_width_mm),
          label_height_mm: Number(data.label_height_mm),
          orientation: data.orientation as 'landscape' | 'portrait',
        });
        
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
      toast({ title: 'Label configuration saved successfully' });
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

  const handleDragStart = (fieldId: string) => {
    setDraggingField(fieldId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggingField) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setFields(fields.map(field => 
      field.id === draggingField ? { ...field, x, y } : field
    ));
    setDraggingField(null);
  };

  const labelScale = config.orientation === 'landscape' 
    ? 400 / config.label_width_mm 
    : 300 / config.label_width_mm;

  const handleTemplateSelect = (templateKey: string) => {
    if (templateKey === 'custom') return;
    
    const template = LABEL_TEMPLATES[templateKey as keyof typeof LABEL_TEMPLATES];
    if (!template) return;

    setConfig({
      ...config,
      ...template.config,
    });
    setFields(template.fields);
    
    toast({ 
      title: 'Template applied', 
      description: `${template.name} has been loaded. Customize as needed.` 
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Label Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="template">Quick Templates</Label>
            <Select onValueChange={handleTemplateSelect}>
              <SelectTrigger id="template">
                <SelectValue placeholder="Select a template to start" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom Configuration</SelectItem>
                <SelectItem value="product">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Product Label</span>
                    <span className="text-xs text-muted-foreground">Standard product label with item details</span>
                  </div>
                </SelectItem>
                <SelectItem value="shipping">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Shipping Label</span>
                    <span className="text-xs text-muted-foreground">Optimized for shipping with serial and barcode</span>
                  </div>
                </SelectItem>
                <SelectItem value="barcode">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Barcode Label</span>
                    <span className="text-xs text-muted-foreground">Minimal label with barcode focus</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  {uploadLogoMutation.isPending ? 'Uploading...' : 'Upload Logo'}
                </Button>
                {config.logo_url && (
                  <img src={config.logo_url} alt="Logo preview" className="h-10 w-auto border rounded" />
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="label_width">Label Width (mm)</Label>
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
              <Label htmlFor="label_height">Label Height (mm)</Label>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Field Positioning</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Drag and drop fields to position them on the label preview
          </p>
          
          <div
            className="border-2 border-dashed rounded-lg bg-white relative overflow-hidden"
            style={{
              width: config.orientation === 'landscape' ? '400px' : '300px',
              height: config.orientation === 'landscape' 
                ? `${config.label_height_mm * labelScale}px`
                : `${config.label_height_mm * labelScale}px`,
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Company Logo Preview */}
            {config.logo_url && (
              <div className="absolute top-2 left-2">
                <img src={config.logo_url} alt="Logo" className="h-8 w-auto" />
              </div>
            )}
            
            {/* Company Name Preview */}
            {config.company_name && (
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2">
                <div className="text-lg font-bold text-black text-center tracking-widest">
                  {config.company_name}
                </div>
              </div>
            )}

            {/* Label Preview with Example Data */}
            <div className="absolute top-12 left-2 right-2 space-y-1 text-black">
              {fields.filter(f => f.enabled && f.id !== 'company_name' && f.id !== 'barcode').map((field) => (
                <div
                  key={field.id}
                  draggable
                  onDragStart={() => handleDragStart(field.id)}
                  className="cursor-move bg-blue-50 border border-blue-200 rounded px-2 py-0.5 text-xs flex items-center gap-1 hover:bg-blue-100 transition-colors"
                  style={{
                    position: 'relative',
                  }}
                >
                  <GripVertical className="h-3 w-3 text-blue-600" />
                  <span className="font-semibold">{field.name}:</span>
                  <span className="text-gray-600">
                    {field.id === 'item_name' && '2565'}
                    {field.id === 'item_code' && '2565110'}
                    {field.id === 'length' && '65 meter'}
                    {field.id === 'width' && '40'}
                    {field.id === 'color' && 'Normal White'}
                    {field.id === 'quality' && 'Normal Hard'}
                    {field.id === 'weight' && '2.5kg'}
                    {field.id === 'serial_no' && '01-M1-041025-00152-0119'}
                  </span>
                </div>
              ))}
            </div>

            {/* Barcode Preview at Bottom */}
            {fields.find(f => f.id === 'barcode' && f.enabled) && (
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-center">
                <div className="text-xs font-mono mb-1 text-black">00054321:2770:001234:1.25</div>
                <div className="flex gap-0.5 justify-center">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-0.5 bg-black"
                      style={{ height: i % 3 === 0 ? '24px' : '20px' }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
            {AVAILABLE_FIELDS.map((field) => {
              const isEnabled = fields.find(f => f.id === field.id)?.enabled;
              return (
                <label key={field.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => {
                      setFields(fields.map(f => 
                        f.id === field.id ? { ...f, enabled: e.target.checked } : f
                      ));
                    }}
                    className="rounded"
                  />
                  {field.name}
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => saveConfigMutation.mutate()}
          disabled={saveConfigMutation.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          {saveConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  );
};

export default LabelConfiguration;