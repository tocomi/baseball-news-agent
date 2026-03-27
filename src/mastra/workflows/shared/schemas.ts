import { z } from 'zod'

export const BASE_URL = 'https://baseball.yahoo.co.jp'
export const SCHEDULE_URL = `${BASE_URL}/npb/schedule/first/all`

export const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
}

export const gameSummarySchema = z.object({
  gameId: z.string(),
  gameUrl: z.string(),
})
