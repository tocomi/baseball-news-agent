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
    // /index は試合終了→/top、試合中→/score にリダイレクトされるため /top を直接使う
    // /top は試合中・試合終了どちらも同じセレクターで取得可能
    const topUrl = inputData.gameUrl.replace(/\/index$/, '/top')
    const res = await fetch(topUrl, { headers: FETCH_HEADERS })
    if (!res.ok) {
      throw new Error(`試合詳細取得失敗: ${res.status} (${topUrl})`)
    }

    const html = await res.text()
    const $ = load(html)

    // 試合中止は除外
    // 試合終了: .bb-gameCard__state span → "試合終了"
    // 試合中:   .bb-gameCard__state a   → "4回裏" などイニング文字列
    const stateSpan = $('.bb-gameCard__state span').first().text().trim()
    const stateLink = $('.bb-gameCard__state a').first().text().trim()
    if (stateSpan === '試合中止') {
      return null
    }
    const inning = /^\d+回(表|裏)$/.test(stateLink) ? stateLink : null

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
      if (!player) return
      if (label === '勝利投手') winningPitcher = player
      else if (label === '敗戦投手') losingPitcher = player
      else if (label === 'セーブ') savePitcher = player
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

    // 球場
    const descText = $('.bb-gameDescription__left').text().replace(/\s+/g, ' ').trim()
    const venue =
      descText
        .replace(/\d+月\d+日（.）/, '')
        .replace(/\d+:\d+/, '')
        .trim() || null

    return {
      gameId: inputData.gameId,
      firstTeam,
      secondTeam,
      firstTeamScore,
      secondTeamScore,
      inning,
      winningPitcher,
      losingPitcher,
      savePitcher,
      homeRuns,
      review,
      venue,
      gameUrl: inputData.gameUrl,
    }
  },
})
