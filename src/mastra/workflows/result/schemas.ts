import { z } from 'zod'

export const homeRunSchema = z.object({
  player: z.string(),
  team: z.string(),
  detail: z.string(), // 例: "1号(1回裏ソロ)"
})

export const gameDetailSchema = z.object({
  gameId: z.string(),
  firstTeam: z.string(), // Yahoo表示上の1番目チーム（ホーム）
  secondTeam: z.string(), // Yahoo表示上の2番目チーム（ビジター）
  firstTeamScore: z.number(),
  secondTeamScore: z.number(),
  winningPitcher: z.string().nullable(),
  losingPitcher: z.string().nullable(),
  savePitcher: z.string().nullable(),
  homeRuns: z.array(homeRunSchema),
  review: z.string().nullable(),
  venue: z.string().nullable(),
  gameUrl: z.string(),
})
