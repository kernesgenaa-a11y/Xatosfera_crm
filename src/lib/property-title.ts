const CATEGORY_TITLE_UK: Record<string, string> = {
  apartment: 'Квартира',
  house: 'Будинок',
  commercial: 'Комерція',
  land_plot: 'Ділянка',
  other: "Об'єкт",
};

const normalizeSpaces = (value: string) => value.replace(/\s+/g, ' ').trim();

export const buildAutoPropertyTitle = (category: string, street?: string | null, buildingNumber?: string | null) => {
  const categoryLabel = CATEGORY_TITLE_UK[category] ?? CATEGORY_TITLE_UK.other;
  return normalizeSpaces([categoryLabel, street ?? '', buildingNumber ?? ''].filter(Boolean).join(' '));
};

export const isLegacyAutoPropertyTitle = (title?: string | null, category?: string | null, street?: string | null, buildingNumber?: string | null) => {
  if (!title || !category) return false;
  const normalizedTitle = normalizeSpaces(title).toLowerCase();
  const legacyTitle = normalizeSpaces([category, street ?? '', buildingNumber ?? ''].filter(Boolean).join(' ')).toLowerCase();
  return normalizedTitle === legacyTitle;
};
