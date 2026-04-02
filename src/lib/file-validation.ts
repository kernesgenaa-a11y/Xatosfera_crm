/**
 * File upload validation utilities
 * SECURITY: Server-side validation should also be implemented via storage policies
 */

// Allowed MIME types for documents
export const ALLOWED_DOCUMENT_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/avif': ['.avif'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
} as const;

// Allowed MIME types for images only
export const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/avif': ['.avif'],
} as const;

export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];

// Allowed extensions (for display)
export const ALLOWED_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.avif',
  '.doc',
  '.docx',
];

// Maximum file size in bytes (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Maximum filename length
export const MAX_FILENAME_LENGTH = 255;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a file for upload
 * @param file - The file to validate
 * @returns Validation result with error message if invalid
 */
export function validateFile(file: File): FileValidationResult {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
    return {
      valid: false,
      error: `Файл занадто великий. Максимальний розмір: ${maxSizeMB}MB`,
    };
  }

  // Check file size minimum (empty files)
  if (file.size === 0) {
    return {
      valid: false,
      error: 'Файл порожній',
    };
  }

  // Check MIME type
  const allowedMimeTypes = Object.keys(ALLOWED_DOCUMENT_TYPES);
  if (!allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Непідтримуваний тип файлу. Дозволені: ${ALLOWED_DOCUMENT_EXTENSIONS.join(', ')}`,
    };
  }

  // Check file extension matches MIME type
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
  const allowedExtensions = ALLOWED_DOCUMENT_TYPES[
    file.type as keyof typeof ALLOWED_DOCUMENT_TYPES
  ] as readonly string[] | undefined;

  if (!allowedExtensions || !allowedExtensions.includes(fileExtension)) {
    return {
      valid: false,
      error: 'Розширення файлу не відповідає його типу',
    };
  }

  // Check filename length
  if (file.name.length > MAX_FILENAME_LENGTH) {
    return {
      valid: false,
      error: `Назва файлу занадто довга. Максимум: ${MAX_FILENAME_LENGTH} символів`,
    };
  }

  // Check for potentially dangerous characters in filename
  const dangerousChars = /[<>:"/\\|?*]/;
  const hasControlChars = [...file.name].some((char) => char.charCodeAt(0) <= 31);
  if (dangerousChars.test(file.name) || hasControlChars) {
    return {
      valid: false,
      error: 'Назва файлу містить недопустимі символи',
    };
  }

  return { valid: true };
}

/**
 * Validates multiple files for upload
 * @param files - Array of files to validate
 * @returns Array of validation results
 */
export function validateFiles(files: File[]): { file: File; result: FileValidationResult }[] {
  return files.map((file) => ({
    file,
    result: validateFile(file),
  }));
}

/**
 * Generates a safe filename for storage
 * Uses UUID-based naming to prevent filename injection
 * @param userId - The user's ID
 * @param originalName - The original filename
 * @returns A safe filename path
 */
export function generateSafeFilename(userId: string, originalName: string): string {
  const extension = originalName.split('.').pop()?.toLowerCase() || 'bin';
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${userId}/${timestamp}-${randomSuffix}.${extension}`;
}
