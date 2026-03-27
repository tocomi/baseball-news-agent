import { createStep } from '@mastra/core/workflows'
import { load } from 'cheerio'

import { BASE_URL, FETCH_HEADERS, gameSummarySchema } from '../shared/schemas'
import { gamePreviewSchema, starterSchema } from './schemas'
import { z } from 'zod'

export const fetchGamePreviewStep = createStep({
  id: 'fetch-game-preview',
  description: '試合詳細ページから予告先発・見どころを取得',
  inputSchema: gameSummarySchema,
  outputSchema: gamePreviewSchema.nullable(),
  execute: async ({ inputData }) => {
    const res = await fetch(inputData.gameUrl, { headers: FETCH_HEADERS })
    if (!res.ok) {
      throw new Error(`試合詳細取得失敗: ${res.status} (${inputData.gameUrl})`)
    }

    const html = await res.text()
    const $ = load(html)

    // 見どころ状態の試合のみ処理
    const state = $('.bb-gameCard__state span').first().text().trim()
    if (state !== '見どころ') {
      return null
    }

    // チーム名
    const teamNames = $('.bb-gameTeam__name')
      .map((_, el) => $(el).text().trim())
      .get()
    const firstTeam = teamNames[0] ?? '不明'
    const secondTeam = teamNames[1] ?? '不明'

    // 試合開始時刻・球場
    const startTime = $('.bb-gameDescription__left time').first().text().trim()
    const descText = $('.bb-gameDescription__left').text().replace(/\s+/g, ' ').trim()
    // "3月28日（土） 14:00 東京ドーム" → 日付・時刻を除いた球場名を抽出
    const venue = descText
      .replace(/\d+月\d+日（.）/, '')
      .replace(/\d+:\d+/, '')
      .trim()

    // 予告先発
    const starters: z.infer<typeof starterSchema>[] = []
    $('#async-starter .bb-splits__item').each((_, item) => {
      const team = $(item).find('.bb-splitsHead h1').text().trim()
      const pitcherEl = $(item).find('.bb-splitsPitcherStarting tbody tr td:last-child a').first()
      const pitcher = pitcherEl.text().trim()
      const pitcherHref = pitcherEl.attr('href') ?? null
      const pitcherUrl = pitcherHref
        ? pitcherHref.startsWith('http')
          ? pitcherHref
          : `${BASE_URL}${pitcherHref}`
        : null
      if (team) {
        starters.push({ team, pitcher: pitcher || '未定', pitcherUrl })
      }
    })

    // 見どころテキスト
    const preview = $('#async-preview .bb-paragraph').first().text().trim() || null

    return {
      gameId: inputData.gameId,
      firstTeam,
      secondTeam,
      startTime,
      venue,
      starters,
      preview,
      gameUrl: inputData.gameUrl,
    }
  },
})
