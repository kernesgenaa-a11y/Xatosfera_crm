import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  FileText,
  Plus,
  Upload,
  Trash2,
  Download,
  FolderOpen,
  FileCheck,
  Building2,
  Handshake,
} from 'lucide-react';
import { cloudflareApi } from '@/integrations/cloudflare/client';
import { toast } from 'sonner';
import { validateFile } from '@/lib/file-validation';
import { getApiUrl } from '@/lib/api-url';
import { useDocuments, type DocumentItem } from '@/hooks/useDocuments';
import { z } from 'zod';

const API_URL = getApiUrl();
const ErrorResponseSchema = z.object({ error: z.string().optional() });

const CATEGORIES = [
  { value: 'fop', labelUk: 'Документи ФОП', labelEn: 'FOP documents', icon: FileCheck },
  {
    value: 'rent_contract',
    labelUk: 'Договори оренди',
    labelEn: 'Rent contracts',
    icon: Building2,
  },
  {
    value: 'sale_contract',
    labelUk: 'Договори продажу',
    labelEn: 'Sale contracts',
    icon: FileText,
  },
  {
    value: 'agency_contract',
    labelUk: 'Договори представництва',
    labelEn: 'Agency contracts',
    icon: Handshake,
  },
];

export const DocumentsPage = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isUk = language === 'uk';
  const queryClient = useQueryClient();
  const documentsQuery = useDocuments(Boolean(user));
  const documents = documentsQuery.data ?? [];
  const loading = documentsQuery.isLoading;
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [newDocument, setNewDocument] = useState({
    title: '',
    category: 'fop',
    file: null as File | null,
  });

  const refreshDocuments = () => queryClient.invalidateQueries({ queryKey: ['documents'] });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (doc: DocumentItem) => {
      const { error } = await cloudflareApi.from('documents').delete().eq('id', doc.id);
      if (error) throw error;

      const storageResult = await cloudflareApi.storage.from('documents').remove([doc.file_url]);
      if (storageResult.error) throw storageResult.error;
    },
    onSuccess: async () => {
      await refreshDocuments();
      toast.success(isUk ? 'Документ видалено' : 'Document deleted');
    },
    onError: (error: unknown) => {
      console.error('Error deleting document:', error);
      toast.error(isUk ? 'Помилка видалення' : 'Failed to delete document');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewDocument((prev) => ({ ...prev, file }));
    }
  };

  const handleUpload = async () => {
    if (!user || !newDocument.file || !newDocument.title) {
      toast.error(isUk ? 'Заповніть всі поля' : 'Fill in all fields');
      return;
    }

    const validation = validateFile(newDocument.file);
    if (!validation.valid) {
      toast.error(validation.error || (isUk ? 'Невалідний файл' : 'Invalid file'));
      return;
    }

    setUploading(true);
    try {
      const token =
        localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token') ?? '';
      const formData = new FormData();
      formData.append('file', newDocument.file);
      formData.append('title', newDocument.title);
      formData.append('category', newDocument.category);

      const response = await fetch(`${API_URL}/api/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: response.statusText }));
        const err = ErrorResponseSchema.safeParse(errData);
        throw new Error((err.success ? err.data.error : undefined) || 'Upload failed');
      }

      toast.success(isUk ? 'Документ завантажено' : 'Document uploaded');
      setDialogOpen(false);
      setNewDocument({ title: '', category: 'fop', file: null });
      await refreshDocuments();
    } catch (error: unknown) {
      console.error('Error uploading document:', error);
      toast.error(isUk ? 'Помилка завантаження' : 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    const shouldDelete = confirm(
      isUk
        ? 'Ви впевнені, що хочете видалити цей документ?'
        : 'Are you sure you want to delete this document?',
    );
    if (!shouldDelete) return;

    await deleteDocumentMutation.mutateAsync(doc);
  };

  const handleDownload = async (doc: DocumentItem) => {
    try {
      const res = cloudflareApi.storage.from('documents').getPublicUrl(doc.file_url);
      if (res.data?.publicUrl) {
        window.open(res.data.publicUrl, '_blank');
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error(isUk ? 'Помилка завантаження документа' : 'Failed to download document');
    }
  };

  const filteredDocuments = documents.filter(
    (doc) => selectedCategory === 'all' || doc.category === selectedCategory,
  );

  const getCategoryLabel = (category: string) => {
    const entry = CATEGORIES.find((item) => item.value === category);
    if (!entry) return category;
    return isUk ? entry.labelUk : entry.labelEn;
  };

  const getCategoryIcon = (category: string) => {
    const entry = CATEGORIES.find((item) => item.value === category);
    return entry?.icon || FileText;
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isUk ? 'Документи' : 'Documents'}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {filteredDocuments.length} {isUk ? 'документів' : 'documents'}
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-accent text-accent-foreground shadow-accent hover:opacity-90">
                <Plus className="mr-2 h-4 w-4" />
                {isUk ? 'Додати документ' : 'Add document'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isUk ? 'Завантажити документ' : 'Upload document'}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{isUk ? 'Назва' : 'Title'}</Label>
                  <Input
                    value={newDocument.title}
                    onChange={(e) => setNewDocument((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder={isUk ? 'Назва документа' : 'Document title'}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{isUk ? 'Категорія' : 'Category'}</Label>
                  <Select
                    value={newDocument.category}
                    onValueChange={(value) =>
                      setNewDocument((prev) => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {isUk ? category.labelUk : category.labelEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{isUk ? 'Файл' : 'File'}</Label>
                  <div className="rounded-lg border-2 border-dashed p-4 text-center">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="flex cursor-pointer flex-col items-center gap-2"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {newDocument.file
                          ? newDocument.file.name
                          : isUk
                            ? 'Натисніть для вибору файлу'
                            : 'Click to select file'}
                      </span>
                    </label>
                  </div>
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={uploading || !newDocument.file || !newDocument.title}
                  className="w-full gradient-primary"
                >
                  {uploading
                    ? isUk
                      ? 'Завантаження...'
                      : 'Uploading...'
                    : isUk
                      ? 'Завантажити'
                      : 'Upload'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-0 shadow-card">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                {isUk ? 'Всі' : 'All'}
              </Button>

              {CATEGORIES.map((category) => {
                const Icon = category.icon;
                return (
                  <Button
                    key={category.value}
                    variant={selectedCategory === category.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category.value)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {isUk ? category.labelUk : category.labelEn}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-0 shadow-card animate-pulse">
                <CardContent className="p-6">
                  <div className="mb-4 h-12 w-12 rounded-lg bg-muted" />
                  <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredDocuments.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredDocuments.map((doc, index) => {
              const Icon = getCategoryIcon(doc.category);
              return (
                <Card
                  key={doc.id}
                  className="border-0 shadow-card transition-all duration-300 hover:shadow-lg animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="rounded-xl bg-primary/10 p-3">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(doc)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <h3 className="truncate font-semibold text-foreground">{doc.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {getCategoryLabel(doc.category)}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString(isUk ? 'uk-UA' : 'en-US')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-0 shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <FileText className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                {isUk ? 'Немає документів' : 'No documents'}
              </h3>
              <p className="mb-6 text-center text-muted-foreground">
                {isUk
                  ? 'Завантажте перший документ для початку'
                  : 'Upload your first document to get started'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};
