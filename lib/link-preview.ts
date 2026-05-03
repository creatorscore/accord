export interface LinkPreviewData {
  url: string;
  title: string;
  description?: string;
  image?: string;
}

// Match URLs in text, excluding trailing punctuation
const URL_REGEX = /https?:\/\/[^\s<>\"')\]]+/gi;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  // Clean trailing punctuation that's not part of the URL
  return matches.map((url) => url.replace(/[.,;:!?)]+$/, ''));
}
