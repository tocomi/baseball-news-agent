import { z } from 'zod'

export const starterSchema = z.object({
  team: z.string(),
  pitcher: z.string(), // 予告なしの場合は "未定"
  pitcherUrl: z.string().nullable(), // 選手ページURL（未定の場合はnull）
})

export const gamePreviewSchema = z.object({
  gameId: z.string(),
  firstTeam: z.string(),
  secondTeam: z.string(),
  startTime: z.string(),
  venue: z.string(),
  starters: z.array(starterSchema),
  preview: z.string().nullable(),
  gameUrl: z.string(),
})
