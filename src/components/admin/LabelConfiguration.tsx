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
  { id: 'weight', name: 'Weight' },
  { id: 'serial_no', name: 'Serial Number' },
  { id: 'barcode', name: 'Barcode' },
];

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Label Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
            className="border-2 border-dashed rounded-lg bg-background relative overflow-hidden"
            style={{
              width: config.orientation === 'landscape' ? '400px' : '300px',
              height: config.orientation === 'landscape' 
                ? `${config.label_height_mm * labelScale}px`
                : `${config.label_height_mm * labelScale}px`,
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {fields.filter(f => f.enabled).map((field) => (
              <div
                key={field.id}
                draggable
                onDragStart={() => handleDragStart(field.id)}
                className="absolute cursor-move bg-primary/10 border border-primary rounded px-2 py-1 text-xs flex items-center gap-1 hover:bg-primary/20 transition-colors"
                style={{
                  left: `${field.x}px`,
                  top: `${field.y}px`,
                }}
              >
                <GripVertical className="h-3 w-3" />
                {field.name}
              </div>
            ))}
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