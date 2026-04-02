import { format } from 'date-fns';
import { enUS, uk } from 'date-fns/locale';
import {
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  MoreVertical,
  Shield,
  Trash2,
  UserCheck,
  UserRoundCheck,
  UserX,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AuthImg } from '@/components/ui/AuthImg';
import type { UserWithRole } from '@/hooks/useUsers';

type Props = {
  userItem: UserWithRole;
  language: string;
  currentUserRole: string | null | undefined;
  currentUserId?: string;
  onApprove: (userId: string) => void;
  onEditRole: (userItem: UserWithRole) => void;
  onActivate: (userId: string) => void;
  onDeactivate: (userId: string) => void;
  onDelete: (userId: string) => void;
  canEditUser: (userRole: string) => boolean;
  t: (key: string) => string;
};

export function UserGridCard({
  userItem,
  language,
  currentUserRole,
  currentUserId,
  onApprove,
  onEditRole,
  onActivate,
  onDeactivate,
  onDelete,
  canEditUser,
  t,
}: Props) {
  const isUk = language === 'uk';
  const dateLocale = isUk ? uk : enUS;

  return (
    <Card
      className={`overflow-hidden border-0 shadow-card transition-opacity ${!userItem.is_active ? 'opacity-60 grayscale' : ''}`}
    >
      <CardContent className="p-0">
        <div
          className={`flex items-center justify-between border-b p-4 ${!userItem.is_active ? 'bg-muted/60' : 'bg-muted/30'}`}
        >
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <Badge variant={userItem.approved ? 'default' : 'secondary'}>
              {userItem.approved
                ? isUk
                  ? 'Підтверджено'
                  : 'Approved'
                : isUk
                  ? 'Очікує'
                  : 'Pending'}
            </Badge>
            {!userItem.is_active && (
              <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">
                {isUk ? 'Неактивний' : 'Inactive'}
              </Badge>
            )}
          </div>

          <Badge
            variant={
              userItem.role === 'superuser'
                ? 'destructive'
                : userItem.role === 'top_manager'
                  ? 'secondary'
                  : 'default'
            }
          >
            {t(`users.${userItem.role}`)}
          </Badge>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex items-center gap-3">
            {userItem.avatar_url ? (
              <AuthImg
                fileKey={userItem.avatar_url}
                alt={userItem.full_name}
                className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
                fallback={
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border ${!userItem.is_active ? 'bg-muted' : 'bg-primary/10'}`}
                  >
                    <span
                      className={`text-sm font-semibold ${!userItem.is_active ? 'text-muted-foreground' : 'text-primary'}`}
                    >
                      {userItem.full_name
                        ?.split(' ')
                        .slice(0, 2)
                        .map((name) => name[0])
                        .join('')
                        .toUpperCase() || '?'}
                    </span>
                  </div>
                }
              />
            ) : (
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border ${!userItem.is_active ? 'bg-muted' : 'bg-primary/10'}`}
              >
                <span
                  className={`text-sm font-semibold ${!userItem.is_active ? 'text-muted-foreground' : 'text-primary'}`}
                >
                  {userItem.full_name
                    ?.split(' ')
                    .slice(0, 2)
                    .map((name) => name[0])
                    .join('')
                    .toUpperCase() || '?'}
                </span>
              </div>
            )}

            <div className="min-w-0 space-y-0.5">
              <h3 className="truncate font-semibold text-foreground">{userItem.full_name}</h3>
              <p className="truncate text-sm text-muted-foreground">{userItem.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {format(new Date(userItem.created_at), 'dd MMMM yyyy', { locale: dateLocale })}
          </div>

          {userItem.approved_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-success" />
              {isUk ? 'Підтверджено' : 'Approved'}{' '}
              {format(new Date(userItem.approved_at), 'dd.MM.yyyy HH:mm', { locale: dateLocale })}
            </div>
          )}

          {!userItem.approved && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-warning" />
              {isUk ? 'Очікує підтвердження' : 'Pending approval'}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t p-4">
          {canEditUser(userItem.role) && userItem.id !== currentUserId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditRole(userItem)}>
                  <Edit className="mr-2 h-4 w-4" />
                  {isUk ? 'Змінити роль' : 'Change role'}
                </DropdownMenuItem>

                {userItem.is_active ? (
                  <DropdownMenuItem
                    onClick={() => onDeactivate(userItem.id)}
                    className="text-warning"
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    {isUk ? 'Деактивувати' : 'Deactivate'}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => onActivate(userItem.id)}
                    className="text-success"
                  >
                    <UserRoundCheck className="mr-2 h-4 w-4" />
                    {isUk ? 'Активувати' : 'Activate'}
                  </DropdownMenuItem>
                )}

                {currentUserRole === 'superuser' && (
                  <DropdownMenuItem
                    onClick={() => onDelete(userItem.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('users.delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!userItem.approved && canEditUser(userItem.role) && userItem.id !== currentUserId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onApprove(userItem.id)}
              className="ml-2 border-success/30 text-success hover:bg-success/10"
            >
              <UserCheck className="mr-1 h-4 w-4" />
              {isUk ? 'Підтвердити' : 'Approve'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
