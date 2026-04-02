import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Download, FileText, Loader2, X } from 'lucide-react';
import { AuthImg } from '@/components/ui/AuthImg';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  PRESENTATION_TEMPLATE_LABELS,
  type PresentationTemplate,
} from '@/lib/presentation-templates';

interface PresentationPreviewModalProps {
  isOpen: boolean;
  isUk: boolean;
  presHtml: string | null;
  presLoading: boolean;
  presDownloading: boolean;
  presentationTemplate: PresentationTemplate;
  editTitle: string;
  editPrice: string;
  editDesc: string;
  photos: string[];
  selectedPhotos: string[];
  onClose: () => void;
  onDownload: () => void | Promise<void>;
  setPresentationTemplate: Dispatch<SetStateAction<PresentationTemplate>>;
  setEditTitle: Dispatch<SetStateAction<string>>;
  setEditPrice: Dispatch<SetStateAction<string>>;
  setEditDesc: Dispatch<SetStateAction<string>>;
  setSelectedPhotos: Dispatch<SetStateAction<string[]>>;
}

interface EditorFieldsProps {
  isUk: boolean;
  photos: string[];
  selectedPhotos: string[];
  presentationTemplate: PresentationTemplate;
  editTitle: string;
  editPrice: string;
  editDesc: string;
  setPresentationTemplate: Dispatch<SetStateAction<PresentationTemplate>>;
  setEditTitle: Dispatch<SetStateAction<string>>;
  setEditPrice: Dispatch<SetStateAction<string>>;
  setEditDesc: Dispatch<SetStateAction<string>>;
  setSelectedPhotos: Dispatch<SetStateAction<string[]>>;
}

function EditorFields({
  isUk,
  photos,
  selectedPhotos,
  presentationTemplate,
  editTitle,
  editPrice,
  editDesc,
  setPresentationTemplate,
  setEditTitle,
  setEditPrice,
  setEditDesc,
  setSelectedPhotos,
}: EditorFieldsProps) {
  return (
    <>
      <div className="space-y-1">
        <label className="text-xs text-slate-500">{isUk ? 'Шаблон' : 'Template'}</label>
        <select
          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          value={presentationTemplate}
          onChange={(e) => setPresentationTemplate(e.target.value as PresentationTemplate)}
        >
          {(Object.keys(PRESENTATION_TEMPLATE_LABELS) as PresentationTemplate[]).map((template) => (
            <option key={template} value={template}>
              {PRESENTATION_TEMPLATE_LABELS[template]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-slate-500">{isUk ? 'Назва' : 'Title'}</label>
        <input
          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-slate-500">{isUk ? 'Ціна' : 'Price'}</label>
        <input
          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
          value={editPrice}
          onChange={(e) => setEditPrice(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-slate-500">{isUk ? 'Опис' : 'Description'}</label>
        <textarea
          rows={4}
          className="w-full resize-none rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
        />
      </div>

      {photos.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs text-slate-500">
            {isUk
              ? `Фото (обрано ${selectedPhotos.length})`
              : `Photos (${selectedPhotos.length} selected)`}
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {photos.map((key, idx) => {
              const checked = selectedPhotos.includes(key);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedPhotos((prev) =>
                      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
                    );
                  }}
                  className={`relative aspect-square overflow-hidden rounded-md border-2 transition-all ${checked ? 'border-amber-400 opacity-100 ring-2 ring-amber-400/30' : 'border-transparent opacity-50 hover:opacity-75'}`}
                >
                  <AuthImg
                    fileKey={key}
                    alt={`фото ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                  {checked && (
                    <div className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-black">
                      {selectedPhotos.indexOf(key) + 1}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="text-[11px] text-amber-300 hover:text-amber-200 hover:underline"
            onClick={() => setSelectedPhotos(photos.slice(0, 6))}
          >
            {isUk ? 'Обрати всі' : 'Select all'}
          </button>
        </div>
      )}
    </>
  );
}

export function PresentationPreviewModal({
  isOpen,
  isUk,
  presHtml,
  presLoading,
  presDownloading,
  presentationTemplate,
  editTitle,
  editPrice,
  editDesc,
  photos,
  selectedPhotos,
  onClose,
  onDownload,
  setPresentationTemplate,
  setEditTitle,
  setEditPrice,
  setEditDesc,
  setSelectedPhotos,
}: PresentationPreviewModalProps) {
  const isMobile = useIsMobile();
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setMobileEditorOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <div className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-none border-0 bg-[#101214] text-white shadow-2xl sm:h-[90vh] sm:rounded-2xl sm:border sm:border-white/10">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#101214] px-3 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-300" />
              <span className="text-sm font-semibold text-white sm:text-base">
                {isUk ? 'Перегляд презентації' : 'Presentation Preview'}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                onClick={() => void onDownload()}
                disabled={presDownloading}
                className="gap-2 bg-amber-400 px-2.5 text-black hover:bg-amber-300 sm:px-3"
              >
                {presDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {isUk ? 'Завантажити PDF' : 'Download PDF'}
                </span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-zinc-300 hover:bg-white/10 hover:text-white"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
            {!isMobile && (
              <div className="order-2 max-h-[45dvh] w-full shrink-0 space-y-4 overflow-y-auto border-t border-white/10 bg-[#15181b] p-4 sm:p-5 lg:order-1 lg:max-h-none lg:w-80 lg:border-r lg:border-t-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300/80">
                  {isUk ? 'Редагувати текст' : 'Edit text'}
                </p>
                <EditorFields
                  isUk={isUk}
                  photos={photos}
                  selectedPhotos={selectedPhotos}
                  presentationTemplate={presentationTemplate}
                  editTitle={editTitle}
                  editPrice={editPrice}
                  editDesc={editDesc}
                  setPresentationTemplate={setPresentationTemplate}
                  setEditTitle={setEditTitle}
                  setEditPrice={setEditPrice}
                  setEditDesc={setEditDesc}
                  setSelectedPhotos={setSelectedPhotos}
                />
              </div>
            )}

            <div className="order-1 flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0b0d0f] lg:order-2">
              {presLoading ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-400">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">{isUk ? 'Завантаження...' : 'Loading...'}</span>
                </div>
              ) : presHtml ? (
                isMobile ? (
                  <div className="flex h-full min-h-0 w-full flex-col">
                    <div className="min-h-0 flex-1 overflow-hidden bg-white">
                      <iframe
                        srcDoc={presHtml}
                        title="presentation-preview"
                        sandbox="allow-scripts"
                        className="block h-full min-h-full w-full border-0"
                      />
                    </div>
                    <div className="shrink-0 border-t border-white/10 bg-[#101214] p-3">
                      <Button
                        className="w-full bg-amber-400 text-black hover:bg-amber-300"
                        onClick={() => setMobileEditorOpen(true)}
                      >
                        {isUk ? 'Редагувати' : 'Edit'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <iframe
                    srcDoc={presHtml}
                    className="h-full w-full border-0"
                    title="presentation-preview"
                    sandbox="allow-scripts"
                  />
                )
              ) : (
                <div className="text-sm text-slate-400">
                  {isUk ? "Не вдалося завантажити прев'ю" : 'Preview unavailable'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isMobile && mobileEditorOpen && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/80 backdrop-blur-sm">
          <div className="max-h-[85dvh] w-full space-y-4 overflow-y-auto rounded-t-2xl border border-white/10 bg-[#15181b] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300/80">
                {isUk ? 'Редагувати текст' : 'Edit text'}
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="text-zinc-300 hover:bg-white/10 hover:text-white"
                onClick={() => setMobileEditorOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <EditorFields
              isUk={isUk}
              photos={photos}
              selectedPhotos={selectedPhotos}
              presentationTemplate={presentationTemplate}
              editTitle={editTitle}
              editPrice={editPrice}
              editDesc={editDesc}
              setPresentationTemplate={setPresentationTemplate}
              setEditTitle={setEditTitle}
              setEditPrice={setEditPrice}
              setEditDesc={setEditDesc}
              setSelectedPhotos={setSelectedPhotos}
            />
          </div>
        </div>
      )}
    </>
  );
}
