import { useMemo, useState } from 'react';
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
import { Users as UsersIcon, Plus, Search } from 'lucide-react';
import { cloudflareApi } from '@/integrations/cloudflare/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';
import { UserGridCard } from '@/components/users/UserGridCard';
import { useUsers, type UserWithRole } from '@/hooks/useUsers';

export const UsersPage = () => {
  const { t, language } = useLanguage();
  const { user, role: currentUserRole, hasPermission } = useAuth();

  const [search, setSearch] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [newRole, setNewRole] = useState('');

  const queryClient = useQueryClient();
  const usersQuery = useUsers(Boolean(user));
  const users = usersQuery.data ?? [];
  const loading = usersQuery.isLoading;
  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const updateUserMutation = useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: string;
      payload: Record<string, unknown>;
    }) => {
      const { error } = await cloudflareApi.from('users').update(payload).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: refreshUsers,
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await cloudflareApi.from('users').delete().eq('id', userId);
      if (error) throw error;
    },
    onSuccess: refreshUsers,
  });

  const handleApproveUser = async (userId: string) => {
    try {
      await updateUserMutation.mutateAsync({
        userId,
        payload: {
          approved: true,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        },
      });
      toast.success(t('users.success_approve'));
    } catch (error: unknown) {
      console.error('Error approving user:', error);
      toast.error(t('users.error_approve'));
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedUser || !newRole) return;

    if (currentUserRole === 'top_manager' && newRole !== 'manager') {
      toast.error(t('users.role_restriction'));
      return;
    }

    try {
      await updateUserMutation.mutateAsync({
        userId: selectedUser.id,
        payload: { role: newRole },
      });

      toast.success(t('users.success_role'));
      setEditDialogOpen(false);
      setSelectedUser(null);
    } catch (error: unknown) {
      console.error('Error updating role:', error);
      toast.error(t('users.error_role'));
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteUserMutation.mutateAsync(userId);
      toast.success(t('users.success_delete'));
    } catch (error: unknown) {
      console.error('Error deleting user:', error);
      toast.error(t('users.error_delete'));
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    try {
      await updateUserMutation.mutateAsync({
        userId,
        payload: { is_active: false },
      });
      toast.success(language === 'uk' ? 'Користувача деактивовано' : 'User deactivated');
    } catch (error: unknown) {
      console.error('Error deactivating user:', error);
      toast.error(t('common.error'));
    }
  };

  const handleActivateUser = async (userId: string) => {
    try {
      await updateUserMutation.mutateAsync({
        userId,
        payload: { is_active: true },
      });
      toast.success(language === 'uk' ? 'Користувача активовано' : 'User activated');
    } catch (error: unknown) {
      console.error('Error activating user:', error);
      toast.error(t('common.error'));
    }
  };

  const canEditUser = (userRole: string) => {
    if (currentUserRole === 'superuser') return true;
    if (currentUserRole === 'top_manager') return userRole === 'manager';
    return false;
  };

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (userItem) =>
          userItem.full_name?.toLowerCase().includes(search.toLowerCase()) ||
          userItem.email.toLowerCase().includes(search.toLowerCase()),
      ),
    [users, search],
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5">
              <UsersIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('users.title')}</h1>
              <p className="text-muted-foreground">
                {language === 'uk' ? 'Керування користувачами системи' : 'Manage system users'}
              </p>
            </div>
          </div>

          {hasPermission('manage_users') && (
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="order-last gradient-primary text-primary-foreground sm:order-none"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('users.add')}
            </Button>
          )}
        </div>

        <Card className="border-0 shadow-card">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={language === 'uk' ? 'Пошук користувачів...' : 'Search users...'}
                className="pl-10"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredUsers.map((userItem) => (
              <UserGridCard
                key={userItem.id}
                userItem={userItem}
                language={language}
                currentUserRole={currentUserRole}
                currentUserId={user?.id}
                onApprove={handleApproveUser}
                onEditRole={(nextUser) => {
                  setSelectedUser(nextUser);
                  setNewRole(nextUser.role);
                  setEditDialogOpen(true);
                }}
                onActivate={handleActivateUser}
                onDeactivate={handleDeactivateUser}
                onDelete={setDeleteUserId}
                canEditUser={canEditUser}
                t={t}
              />
            ))}
          </div>
        ) : (
          <Card className="border-0 shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <UsersIcon className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">{t('common.noData')}</h3>
              <p className="text-muted-foreground">
                {language === 'uk' ? 'Користувачів не знайдено' : 'No users found'}
              </p>
            </CardContent>
          </Card>
        )}

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {language === 'uk' ? 'Змінити роль користувача' : 'Change user role'}
              </DialogTitle>
              <DialogDescription>{selectedUser?.full_name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('users.role')}</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentUserRole === 'superuser' && (
                      <>
                        <SelectItem value="superuser">{t('users.superuser')}</SelectItem>
                        <SelectItem value="top_manager">{t('users.topmanager')}</SelectItem>
                      </>
                    )}
                    <SelectItem value="manager">{t('users.manager')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleUpdateRole} className="w-full gradient-primary">
                {t('common.save')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <CreateUserDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onUserCreated={refreshUsers}
          canCreateTopManager={currentUserRole === 'superuser'}
        />

        <AlertDialog
          open={!!deleteUserId}
          onOpenChange={(open) => {
            if (!open) setDeleteUserId(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {language === 'uk' ? 'Видалити користувача?' : 'Delete user?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {language === 'uk'
                  ? 'Цю дію неможливо скасувати. Обліковий запис буде видалено назавжди.'
                  : 'This action cannot be undone. The account will be permanently deleted.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteUserId(null)}>
                {language === 'uk' ? 'Скасувати' : 'Cancel'}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteUserId) {
                    void handleDeleteUser(deleteUserId);
                    setDeleteUserId(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {language === 'uk' ? 'Так, видалити' : 'Yes, delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};
