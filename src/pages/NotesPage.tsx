import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getApiUrl } from '@/lib/api-url';
import { toast } from 'sonner';
import { useNotes } from '@/hooks/useNotes';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Loader2,
  Plus,
  StickyNote,
  Trash2,
  User,
  UserCheck,
  XCircle,
} from 'lucide-react';

const API_URL = getApiUrl();

type Note = {
  id: string;
  title: string;
  content: string | null;
  priority: 'low' | 'medium' | 'high';
  done: number | boolean;
  result: 'done' | 'not_done' | null;
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_by_name: string | null;
  assigned_to_name: string | null;
  created_at: string;
};

type Manager = { id: string; full_name: string };

const PRIORITY_CONFIG = {
  high: {
    label: 'Високий',
    labelEn: 'High',
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
  medium: {
    label: 'Середній',
    labelEn: 'Medium',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  low: {
    label: 'Низький',
    labelEn: 'Low',
    color: 'text-slate-500',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
} as const;

export const NotesPage = () => {
  const { language } = useLanguage();
  const { user, role } = useAuth();
  const isUk = language === 'uk';
  const isTopManager = role === 'top_manager' || role === 'superuser';
  const isManager = role === 'manager';

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', priority: 'medium', assigned_to: '' });
  const [saving, setSaving] = useState(false);
  const [completeNote, setCompleteNote] = useState<Note | null>(null);
  const [completeResult, setCompleteResult] = useState<'done' | 'not_done'>('done');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const notesQuery = useNotes(isTopManager, user?.id);
  const notes = (notesQuery.notes ?? []) as Note[];
  const managers = (notesQuery.managers ?? []) as Manager[];
  const loading = notesQuery.isLoading;
  const refreshNotes = () => queryClient.invalidateQueries({ queryKey: ['notes'] });

  const createNoteMutation = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/api/notes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create note');
    },
    onSuccess: refreshNotes,
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/api/notes/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update note');
    },
    onSuccess: refreshNotes,
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/api/notes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete note');
    },
    onSuccess: refreshNotes,
  });

  const { personalNotes, myTasks, assignedTasks, completedTasks } = useMemo(() => {
    const personal: Note[] = [];
    const myT: Note[] = [];
    const assigned: Note[] = [];
    const completed: Note[] = [];
    notes.forEach((note) => {
      const isDone = Boolean(note.done);
      if (isDone || note.result) {
        completed.push(note);
        return;
      }
      if (note.assigned_to && note.assigned_by) {
        if (isManager && note.assigned_to === user?.id) myT.push(note);
        else if (isTopManager) assigned.push(note);
      } else {
        personal.push(note);
      }
    });
    return {
      personalNotes: personal,
      myTasks: myT,
      assignedTasks: assigned,
      completedTasks: completed,
    };
  }, [notes, user?.id, isManager, isTopManager]);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const body: Record<string, string> = {
      title: form.title.trim(),
      content: form.content,
      priority: form.priority,
    };
    if (isTopManager && form.assigned_to) body.assigned_to = form.assigned_to;
    await createNoteMutation.mutateAsync(body);
    setSaving(false);
    toast.success(
      form.assigned_to
        ? isUk
          ? 'Завдання надіслано'
          : 'Task assigned'
        : isUk
          ? 'Нотатку додано'
          : 'Note added',
    );
    setForm({ title: '', content: '', priority: 'medium', assigned_to: '' });
    setCreateOpen(false);
  };

  const handleComplete = async () => {
    if (!completeNote) return;
    await updateNoteMutation.mutateAsync({
      id: completeNote.id,
      body: { done: 1, result: completeResult, completed_at: new Date().toISOString() },
    });
    toast.success(
      completeResult === 'done'
        ? isUk
          ? 'Завдання виконано'
          : 'Task done'
        : isUk
          ? 'Позначено як невиконане'
          : 'Marked as not done',
    );
    setCompleteNote(null);
  };

  const togglePersonal = async (note: Note) => {
    await updateNoteMutation.mutateAsync({ id: note.id, body: { done: note.done ? 0 : 1 } });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteNoteMutation.mutateAsync(deleteId);
    setDeleteId(null);
    toast.success(isUk ? 'Видалено' : 'Deleted');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(242,190,82,0.18),transparent_35%),linear-gradient(180deg,rgba(18,18,18,0.94),rgba(8,8,8,0.94))] p-6 shadow-2xl sm:flex-row sm:items-center">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <ClipboardList className="h-6 w-6 text-amber-300" />
              {isUk ? 'Завдання та нотатки' : 'Tasks & Notes'}
            </h1>
            <p className="mt-1 text-sm text-zinc-300">
              {isUk
                ? 'Особисті нотатки та завдання від керівника'
                : 'Personal notes and manager tasks'}
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="shrink-0 gap-2 bg-amber-400 text-black hover:bg-amber-300"
          >
            <Plus className="h-4 w-4" />
            {isTopManager ? (isUk ? 'Створити' : 'Create') : isUk ? 'Нотатка' : 'Add Note'}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {isManager && myTasks.length > 0 && (
              <Section
                title={isUk ? 'Мої завдання' : 'My Tasks'}
                subtitle={isUk ? 'Завдання від керівника' : 'Tasks from manager'}
                count={myTasks.length}
              >
                {myTasks.map((note) => (
                  <TaskCard
                    key={note.id}
                    note={note}
                    isUk={isUk}
                    isTopManager={false}
                    onComplete={() => {
                      setCompleteNote(note);
                      setCompleteResult('done');
                    }}
                  />
                ))}
              </Section>
            )}
            {isTopManager && assignedTasks.length > 0 && (
              <Section
                title={isUk ? 'Надіслані завдання' : 'Assigned Tasks'}
                subtitle={isUk ? 'Завдання що очікують виконання' : 'Tasks pending completion'}
                count={assignedTasks.length}
              >
                {assignedTasks.map((note) => (
                  <TaskCard
                    key={note.id}
                    note={note}
                    isUk={isUk}
                    isTopManager
                    onDelete={() => setDeleteId(note.id)}
                  />
                ))}
              </Section>
            )}
            <Section
              title={isUk ? 'Особисті нотатки' : 'Personal Notes'}
              subtitle={isUk ? 'Нотатки для себе' : 'Notes for yourself'}
              count={personalNotes.length}
            >
              {personalNotes.length === 0 ? (
                <EmptyState text={isUk ? 'Немає нотаток' : 'No notes yet'} />
              ) : (
                personalNotes.map((note) => (
                  <PersonalNoteCard
                    key={note.id}
                    note={note}
                    isUk={isUk}
                    onToggle={() => void togglePersonal(note)}
                    onDelete={isTopManager ? () => setDeleteId(note.id) : undefined}
                  />
                ))
              )}
            </Section>
            {completedTasks.length > 0 && (
              <Section
                title={isUk ? 'Завершені' : 'Completed'}
                subtitle={isUk ? 'Виконані завдання та нотатки' : 'Done tasks and notes'}
                count={completedTasks.length}
                collapsible
              >
                {completedTasks.map((note) => (
                  <CompletedCard
                    key={note.id}
                    note={note}
                    isUk={isUk}
                    onDelete={isTopManager ? () => setDeleteId(note.id) : undefined}
                  />
                ))}
              </Section>
            )}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              {isTopManager
                ? isUk
                  ? 'Нотатка або завдання'
                  : 'Note or Task'
                : isUk
                  ? 'Нова нотатка'
                  : 'New Note'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {isTopManager && managers.length > 0 && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm">
                  <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  {isUk ? 'Призначити агенту' : 'Assign to Agent'}
                  <span className="text-xs text-muted-foreground">
                    {isUk ? '(якщо завдання)' : '(if task)'}
                  </span>
                </Label>
                <Select
                  value={form.assigned_to}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, assigned_to: value === '__none__' ? '' : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isUk ? 'Особиста нотатка' : 'Personal note'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {isUk ? '— Особиста нотатка —' : '— Personal note —'}
                    </SelectItem>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.assigned_to && (
                  <div className="flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1.5 text-xs text-blue-600">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {isUk ? 'Агент отримає сповіщення' : 'Manager will receive a notification'}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-sm">
                {form.assigned_to ? (isUk ? 'Завдання' : 'Task') : isUk ? 'Назва' : 'Title'} *
              </Label>
              <input
                placeholder={
                  form.assigned_to
                    ? isUk
                      ? 'Опишіть завдання...'
                      : 'Describe the task...'
                    : isUk
                      ? 'Назва нотатки...'
                      : 'Note title...'
                }
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{isUk ? 'Нотатки' : 'Notes'}</Label>
              <Textarea
                placeholder={
                  isUk ? 'Детальний опис, інструкції...' : 'Detailed description, instructions...'
                }
                value={form.content}
                onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{isUk ? 'Пріоритет' : 'Priority'}</Label>
              <Select
                value={form.priority}
                onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{isUk ? 'Низький' : 'Low'}</SelectItem>
                  <SelectItem value="medium">{isUk ? 'Середній' : 'Medium'}</SelectItem>
                  <SelectItem value="high">{isUk ? 'Високий' : 'High'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => void handleCreate()}
              disabled={!form.title.trim() || saving}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {form.assigned_to
                ? isUk
                  ? 'Надіслати завдання'
                  : 'Send Task'
                : isUk
                  ? 'Зберегти нотатку'
                  : 'Save Note'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!completeNote} onOpenChange={(open) => !open && setCompleteNote(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              {isUk ? 'Завершити завдання' : 'Complete Task'}
            </DialogTitle>
          </DialogHeader>
          {completeNote && (
            <div className="space-y-4 pt-1">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">{completeNote.title}</p>
                {completeNote.content && (
                  <p className="mt-1 text-xs text-muted-foreground">{completeNote.content}</p>
                )}
                {completeNote.assigned_by_name && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" /> {isUk ? 'Від:' : 'From:'}{' '}
                    {completeNote.assigned_by_name}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">
                  {isUk ? 'Результат виконання' : 'Completion result'}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCompleteResult('done')}
                    className={`flex items-center justify-center gap-2 rounded-lg border-2 py-3 text-sm font-medium transition-all ${completeResult === 'done' ? 'border-green-500 bg-green-50 text-green-700' : 'border-border hover:border-green-300'}`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {isUk ? 'Виконано' : 'Done'}
                  </button>
                  <button
                    onClick={() => setCompleteResult('not_done')}
                    className={`flex items-center justify-center gap-2 rounded-lg border-2 py-3 text-sm font-medium transition-all ${completeResult === 'not_done' ? 'border-red-400 bg-red-50 text-red-700' : 'border-border hover:border-red-300'}`}
                  >
                    <XCircle className="h-4 w-4" />
                    {isUk ? 'Не виконано' : 'Not Done'}
                  </button>
                </div>
              </div>
              <Button className="w-full" onClick={() => void handleComplete()}>
                {isUk ? 'Підтвердити' : 'Confirm'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {notesQuery.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => void notesQuery.fetchNextPage()}
            disabled={notesQuery.isFetchingNextPage}
          >
            {notesQuery.isFetchingNextPage
              ? isUk
                ? 'Завантаження...'
                : 'Loading...'
              : isUk
                ? 'Завантажити ще'
                : 'Load more'}
          </Button>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isUk ? 'Видалити?' : 'Delete?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isUk ? 'Цю дію неможливо скасувати.' : 'This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isUk ? 'Скасувати' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              {isUk ? 'Видалити' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

function Section({
  title,
  subtitle,
  count,
  children,
  collapsible,
}: {
  title: string;
  subtitle: string;
  count: number;
  children: React.ReactNode;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-xl backdrop-blur-md">
      <div
        className={`flex items-center gap-2 border-b border-white/10 px-5 py-4 ${collapsible ? 'cursor-pointer select-none' : ''}`}
        onClick={collapsible ? () => setOpen((value) => !value) : undefined}
      >
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="text-xs text-zinc-400">{subtitle}</div>
        </div>
        <span className="rounded-full bg-amber-300 px-2 py-0.5 text-xs font-bold text-black">
          {count}
        </span>
        {collapsible && (
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`}
          />
        )}
      </div>
      {(!collapsible || open) && <div className="space-y-3 px-4 pb-4 pt-4">{children}</div>}
    </div>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
  return (
    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} title={cfg.label} />
  );
}

function TaskCard({
  note,
  isUk,
  isTopManager,
  onComplete,
  onDelete,
}: {
  note: Note;
  isUk: boolean;
  isTopManager: boolean;
  onComplete?: () => void;
  onDelete?: () => void;
}) {
  const priorityCfg = PRIORITY_CONFIG[note.priority] || PRIORITY_CONFIG.medium;
  return (
    <div className="group space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-4 transition-all hover:border-amber-300/30 hover:bg-white/[0.06]">
      <div className="flex items-start gap-2">
        <PriorityDot priority={note.priority} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{note.title}</p>
          {note.content && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{note.content}</p>
          )}
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-0.5 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${priorityCfg.bg} ${priorityCfg.color} ${priorityCfg.border}`}
        >
          {isUk ? priorityCfg.label : priorityCfg.labelEn}
        </span>
        {note.assigned_by_name && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            {note.assigned_by_name}
          </span>
        )}
        {note.assigned_to_name && isTopManager && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <UserCheck className="h-3 w-3" />
            {note.assigned_to_name}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-xs text-zinc-500">
          <Clock className="h-3 w-3" />
          {new Date(note.created_at).toLocaleDateString('uk-UA')}
        </span>
      </div>
      {onComplete && !isTopManager && (
        <Button
          size="sm"
          className="h-8 w-full gap-1.5 bg-amber-400 text-xs text-black hover:bg-amber-300"
          onClick={onComplete}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {isUk ? 'Завершити завдання' : 'Complete Task'}
        </Button>
      )}
    </div>
  );
}

function PersonalNoteCard({
  note,
  isUk,
  onToggle,
  onDelete,
}: {
  note: Note;
  isUk: boolean;
  onToggle: () => void;
  onDelete?: () => void;
}) {
  const priorityCfg = PRIORITY_CONFIG[note.priority] || PRIORITY_CONFIG.medium;
  return (
    <div
      className="group flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300/10 bg-[linear-gradient(180deg,rgba(22,22,24,0.92),rgba(12,12,14,0.96))] p-4 shadow-lg shadow-black/20 transition-all hover:border-amber-300/30 hover:bg-[linear-gradient(180deg,rgba(28,28,30,0.96),rgba(14,14,16,0.98))]"
      onClick={onToggle}
    >
      <div
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${note.done ? 'border-amber-400 bg-amber-400' : 'border-zinc-500/40'}`}
      >
        {Boolean(note.done) && <CheckCircle2 className="h-3 w-3 text-white" />}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium leading-snug ${note.done ? 'line-through text-muted-foreground' : ''}`}
        >
          {note.title}
        </p>
        {note.content && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{note.content}</p>
        )}
        <span
          className={`mt-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${priorityCfg.bg} ${priorityCfg.color} ${priorityCfg.border}`}
        >
          <PriorityDot priority={note.priority} />
          {isUk ? priorityCfg.label : priorityCfg.labelEn}
        </span>
      </div>
      {onDelete && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="shrink-0 p-0.5 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function CompletedCard({
  note,
  isUk,
  onDelete,
}: {
  note: Note;
  isUk: boolean;
  onDelete?: () => void;
}) {
  const isDone = note.result === 'done' || (Boolean(note.done) && !note.result);
  const isNotDone = note.result === 'not_done';
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-4 opacity-80">
      <div className="mt-0.5 shrink-0">
        {isDone && <CheckCircle2 className="h-4 w-4 text-green-500" />}
        {isNotDone && <XCircle className="h-4 w-4 text-red-400" />}
        {!isDone && !isNotDone && <CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-through text-sm leading-snug text-muted-foreground">{note.title}</p>
        {note.result && (
          <span
            className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isDone ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}
          >
            {isDone ? (isUk ? 'Виконано' : 'Done') : isUk ? 'Не виконано' : 'Not done'}
          </span>
        )}
        {note.assigned_by_name && (
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            <User className="h-2.5 w-2.5" />
            {note.assigned_by_name}
          </p>
        )}
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          className="shrink-0 p-0.5 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-8 text-center text-muted-foreground/50">
      <StickyNote className="mx-auto mb-2 h-8 w-8 opacity-30" />
      <p className="text-xs">{text}</p>
    </div>
  );
}
