export const mediaQueryKeys = {
  all: ['media'] as const,
  list: () => [...mediaQueryKeys.all, 'list'] as const,
  detail: (mediaId: string) => [...mediaQueryKeys.all, 'detail', mediaId] as const,
  tags: () => [...mediaQueryKeys.all, 'tags'] as const,
}