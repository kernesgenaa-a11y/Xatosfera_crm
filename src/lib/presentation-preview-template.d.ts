export const PAGE_WIDTH_MM: 210;
export const PAGE_HEIGHT_MM: 297;

export type PreviewPresentationTemplate = 'classic' | 'editorial' | 'minimal';
export type PreviewPresentationSpecEntry = [string, string | number];

export interface PreviewPresentationManager {
  full_name?: string | null;
  phone?: string | null;
}

export interface BuildPropertyPresentationHtmlInput {
  template: PreviewPresentationTemplate;
  isPreview: boolean;
  logoHtml: string;
  opLabel: string;
  catLabel: string;
  price: string;
  pricePerSqm: string;
  address: string;
  displayTitle: string;
  displayDesc: string | null;
  photoDataUrls: string[];
  photoGrid: string;
  specs: PreviewPresentationSpecEntry[];
  specsRows: string;
  classicDetailsGrid: string;
  manager: PreviewPresentationManager | null;
  managerBlock: string;
  tagsHtml: string;
}

export function buildPropertyPresentationHtml(input: BuildPropertyPresentationHtmlInput): string;
