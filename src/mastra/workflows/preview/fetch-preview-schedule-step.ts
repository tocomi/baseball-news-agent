import { createStep } from '@mastra/core/workflows'
import { load } from 'cheerio'
import { z } from 'zod'

import { BASE_URL, FETCH_HEADERS, SCHEDULE_URL, gameSummarySchema } from '../shared/schemas'

export const fetchPreviewScheduleStep = createStep({
  id: 'fetch-preview-schedule',
  description: 'Yahoo Baseballから本日の1軍試合URLリストを取得（見どころのみ）',
  inputSchema: z.object({}),
  outputSchema: z.object({
    games: z.array(gameSummarySchema),
  }),
  execute: async () => {
    const today = new Date()
    const month = today.getMonth() + 1
    const day = today.getDate()
    const yyyy = today.getFullYear()
    const mm = String(month).padStart(2, '0')
    const dd = String(day).padStart(2, '0')

    const url = `${SCHEDULE_URL}?date=${yyyy}-${mm}-${dd}`
    const res = await fetch(url, { headers: FETCH_HEADERS })
    if (!res.ok) {
      throw new Error(`スケジュール取得失敗: ${res.status}`)
    }

    const html = await res.text()
    const $ = load(html)

    const todayPattern = `${month}月${day}日`
    const games: z.infer<typeof gameSummarySchema>[] = []

    $('.bb-scheduleTable tbody').each((_, tbody) => {
      const dateHeader = $(tbody).find('th.bb-scheduleTable__head[scope="row"]').first()
      if (!dateHeader.text().includes(todayPattern)) return

      // 「見どころ」のみ（予告先発・見どころテキストが掲載済みの試合）
      $(tbody)
        .find('.bb-scheduleTable__status a')
        .each((_, statusEl) => {
          if ($(statusEl).text().trim() !== '見どころ') return
          const href = $(statusEl).attr('href') ?? ''
          const m = href.match(/\/npb\/game\/(\d+)\//)
          if (!m) return
          games.push({
            gameId: m[1],
            gameUrl: href.startsWith('http') ? href : `${BASE_URL}${href}`,
          })
        })
    })

    return { games }
  },
})
