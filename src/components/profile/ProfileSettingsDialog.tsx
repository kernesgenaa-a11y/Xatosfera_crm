import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

import { cloudflareApi as pb } from '@/integrations/cloudflare/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, Phone, Camera, Loader2 } from 'lucide-react';
import { useAuthImage } from '@/hooks/useAuthImage';
import { getApiUrl } from '@/lib/api-url';
import { z } from 'zod';

const API_URL = getApiUrl();
const FileUploadResponseSchema = z.object({ key: z.string() });

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfileSettingsDialog = ({ open, onOpenChange }: ProfileSettingsDialogProps) => {
  const { t } = useLanguage();
  const { user, profile, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  // Зберігаємо тільки R2 key — useAuthImage зробить blob URL
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Blob URL для аватару через authenticated fetch
  const avatarUrl = useAuthImage(avatarKey);

  // Оновлення стану при зміні профілю
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setAvatarKey(profile.avatar_url || null);
    }
  }, [profile]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      // Upload avatar through API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'avatars');

      const token = localStorage.getItem('access_token');
      const uploadResponse = await fetch(`${API_URL}/api/files/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload avatar');
      }

      const uploadData = FileUploadResponseSchema.parse(await uploadResponse.json());

      // Update user profile with new avatar URL
      const { error: updateError } = await pb
        .from('users')
        .update({
          avatar_url: uploadData.key,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Показуємо новий аватар одразу
      setAvatarKey(uploadData.key);
      await refreshProfile();
      toast.success('Аватар оновлено');
    } catch (error: unknown) {
      console.error('Error uploading avatar:', error);
      toast.error(error instanceof Error ? error.message : 'Помилка завантаження аватару');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Оновлення профілю (без аватару, бо він окремо)
      const { error: updateError } = await pb
        .from('users')
        .update({
          full_name: fullName,
          phone,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      toast.success('Налаштування збережено');
      onOpenChange(false);
    } catch (error: unknown) {
      console.error('Error saving profile:', error);
      toast.error(error.message || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[425px]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('nav.settings')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="w-24 h-24">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={fullName} />
                ) : (
                  <AvatarFallback className="gradient-primary text-primary-foreground text-2xl">
                    {fullName?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                )}
              </Avatar>
              <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
                {uploading ? (
                  <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-primary-foreground" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={uploading}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Натисніть на камеру для завантаження фото
            </p>
          </div>

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {t('auth.fullName')}
            </Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Телефон
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+380..."
            />
          </div>

          {/* Save Button */}
          <Button onClick={handleSave} className="w-full gradient-primary" disabled={saving}>
            {saving ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
