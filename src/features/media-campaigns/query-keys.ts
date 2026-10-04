export const mediaCampaignQueryKeys = {
  all: ['media-campaigns'] as const,
  list: () => [...mediaCampaignQueryKeys.all, 'list'] as const,
  detail: (campaignId: string) => [...mediaCampaignQueryKeys.all, 'detail', campaignId] as const,
}
