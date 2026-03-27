import { createStep } from '@mastra/core/workflows'
import { load } from 'cheerio'

import { FETCH_HEADERS, gameSummarySchema } from '../shared/schemas'
import { gameDetailSchema, homeRunSchema } from './schemas'
import { z } from 'zod'

export const fetchGameDetailStep = createStep({
  id: 'fetch-game-detail',
  description: '試合詳細ページからスコア・投手・HR・戦評を取得（試合終了・試合中）',
  inputSchema: gameSummarySchema,
  outputSchema: gameDetailSchema.nullable(),
  execute: async ({ inputData }) => {
    const res = await fetch(inputData.gameUrl, { headers: FETCH_HEADERS })
    if (!res.ok) {
      throw new Error(`試合詳細取得失敗: ${res.status} (${inputData.gameUrl})`)
    }

    const html = await res.text()
    const $ = load(html)

    // 試合開始前（未開始）は除外
    const state = $('.bb-gameCard__state span').first().text().trim()
    if (state !== '試合終了' && state !== '試合中') {
      return null
    }

    // チーム名
    const teamNames = $('.bb-gameTeam__name')
      .map((_, el) => $(el).text().trim())
      .get()
    const firstTeam = teamNames[0] ?? '不明'
    const secondTeam = teamNames[1] ?? '不明'

    // スコア
    const firstTeamScore = parseInt($('.bb-gameTeam__homeScore').first().text().trim()) || 0
    const secondTeamScore = parseInt($('.bb-gameTeam__awayScore').first().text().trim()) || 0

    // 責任投手
    let winningPitcher: string | null = null
    let losingPitcher: string | null = null
    let savePitcher: string | null = null

    $('#async-resultPitcher .bb-gameTable tbody tr').each((_, row) => {
      const label = $(row).find('th').text().trim()
      const player = $(row).find('.bb-gameTable__player').first().text().trim()
      const team = $(row).find('.bb-gameTable__team').first().text().trim()
      if (!player) return
      const name = team ? `${team} ${player}` : player
      if (label === '勝利投手') winningPitcher = name
      else if (label === '敗戦投手') losingPitcher = name
      else if (label === 'セーブ') savePitcher = name
    })

    // 本塁打
    const homeRuns: z.infer<typeof homeRunSchema>[] = []

    $('#async-homerun .bb-gameTable tbody tr').each((_, row) => {
      const team = $(row).find('th').text().trim()
      const td = $(row).find('td')

      td.find('.bb-gameTable__player').each((_, playerEl) => {
        const player = $(playerEl).text().trim()
        // playerElの直後のテキストノードから "1号(1回裏ソロ)" などを取得
        const next = playerEl.nextSibling
        const detail =
          next && 'data' in next
            ? String((next as { data: string }).data)
                .replace(/\s+/g, ' ')
                .trim()
            : ''
        if (player) {
          homeRuns.push({ player, team, detail })
        }
      })
    })

    // 戦評
    const review = $('#async-recap .bb-paragraph').first().text().trim() || null

    return {
      gameId: inputData.gameId,
      firstTeam,
      secondTeam,
      firstTeamScore,
      secondTeamScore,
      winningPitcher,
      losingPitcher,
      savePitcher,
      homeRuns,
      review,
      gameUrl: inputData.gameUrl,
    }
  },
})
