function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, '');
}

function stripControlChars(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ');
}

export function sanitizeText(value: string) {
  return stripControlChars(stripTags(value)).replace(/\s+/g, ' ').trim();
}

export function sanitizeMultilineText(value: string) {
  return stripControlChars(stripTags(value))
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function sanitizeEmail(value: string) {
  return sanitizeText(value).toLowerCase();
}
