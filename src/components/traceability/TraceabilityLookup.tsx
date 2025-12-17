import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, QrCode, Loader2, X } from 'lucide-react';
import { useTraceability } from '@/hooks/useTraceability';
import { TraceabilityViewer } from './TraceabilityViewer';

export const TraceabilityLookup = () => {
  const [searchInput, setSearchInput] = useState('');
  const [serialNumber, setSerialNumber] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { data: traceabilityData, isLoading, error } = useTraceability(serialNumber);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  const handleSearch = () => {
    const trimmed = searchInput.trim();
    if (trimmed) {
      // Try to parse QR code data if it contains JSON
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.serial) {
          setSerialNumber(parsed.serial);
          return;
        }
      } catch {
        // Not JSON, treat as serial number
      }
      setSerialNumber(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setSearchInput('');
    setSerialNumber(null);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Product Traceability Lookup
          </CardTitle>
          <CardDescription>
            Enter a serial number or scan a QR code to view the complete production lineage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="serial-input">Serial Number or QR Code Data</Label>
              <div className="relative">
                <Input
                  ref={inputRef}
                  id="serial-input"
                  placeholder="e.g., 01-M1-171224-00001-1430"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pr-10"
                />
                {searchInput && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={handleClear}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={!searchInput.trim() || isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4 text-destructive">
            Error loading traceability data. Please try again.
          </CardContent>
        </Card>
      )}

      {serialNumber && !isLoading && traceabilityData && (
        <TraceabilityViewer 
          node={traceabilityData.lineage} 
          children={traceabilityData.children}
        />
      )}

      {serialNumber && !isLoading && !traceabilityData?.lineage && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No production record found for serial number: <span className="font-mono">{serialNumber}</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
