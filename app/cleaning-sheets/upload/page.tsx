'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function UploadCleaningSheetPage() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/cleaning-sheets/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload cleaning sheet');
      }

      const data = await response.json();
      toast.success('Cleaning sheet processed successfully!');
      router.push('/cleaning-sheets');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            onClick={() => router.push('/cleaning-sheets')}
          >
            Back to Sheets
          </Button>
          <h1 className="text-3xl font-bold">Upload Cleaning Sheet</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload New Cleaning Sheet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <FileText className="w-12 h-12 mx-auto text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Upload Cleaning Sheet
              </h2>
              <p className="text-muted-foreground mb-4">
                Upload a PDF or Excel file containing cleaning tasks to automatically
                generate standardized task lists.
              </p>
            </div>

            <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".pdf,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={isUploading}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  {isUploading ? 'Processing...' : 'Click to upload'}
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  PDF or Excel files only
                </span>
              </label>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 