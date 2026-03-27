import { createStep } from '@mastra/core/workflows'
import { load } from 'cheerio'
import { z } from 'zod'

import { BASE_URL, FETCH_HEADERS, SCHEDULE_URL, gameSummarySchema } from '../shared/schemas'

export const fetchScheduleStep = createStep({
  id: 'fetch-schedule',
  description: 'Yahoo Baseballから指定日の1軍試合URLリストを取得（試合終了・試合中）',
  inputSchema: z.object({ date: z.string().optional() }),
  outputSchema: z.object({
    games: z.array(gameSummarySchema),
    dateStr: z.string(),
  }),
  execute: async ({ inputData }) => {
    const target = inputData.date ? new Date(inputData.date) : new Date()
    const month = target.getMonth() + 1
    const day = target.getDate()
    const yyyy = target.getFullYear()
    const mm = String(month).padStart(2, '0')
    const dd = String(day).padStart(2, '0')

    // スケジュールページは週単位で複数日が表示されるため日付パラメータを指定
    const url = `${SCHEDULE_URL}?date=${yyyy}-${mm}-${dd}`
    const res = await fetch(url, { headers: FETCH_HEADERS })
    if (!res.ok) {
      throw new Error(`スケジュール取得失敗: ${res.status}`)
    }

    const html = await res.text()
    const $ = load(html)

    // 対象日の日付文字列（例: "3月27日"）でtbodyを絞り込む
    const todayPattern = `${month}月${day}日`
    const games: z.infer<typeof gameSummarySchema>[] = []

    $('.bb-scheduleTable tbody').each((_, tbody) => {
      const dateHeader = $(tbody).find('th.bb-scheduleTable__head[scope="row"]').first()
      if (!dateHeader.text().includes(todayPattern)) return

      $(tbody)
        .find('.bb-scheduleTable__status a')
        .each((_, statusEl) => {
          const statusText = $(statusEl).text().trim()
          if (statusText !== '試合終了' && statusText !== '試合中') return
          const href = $(statusEl).attr('href') ?? ''
          const m = href.match(/\/npb\/game\/(\d+)\//)
          if (!m) return
          games.push({
            gameId: m[1],
            gameUrl: href.startsWith('http') ? href : `${BASE_URL}${href}`,
          })
        })
    })

    return { games, dateStr: `${month}月${day}日` }
  },
})
