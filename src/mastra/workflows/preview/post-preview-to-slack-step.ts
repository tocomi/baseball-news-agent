import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'

import { formatDateLabel } from '../../utils/date'
import { gamePreviewSchema } from './schemas'

interface SlackPostParams {
  channel: string
  text: string
  thread_ts?: string
}

interface SlackPostResponse {
  ok: boolean
  ts?: string
  error?: string
}

async function postSlackMessage(
  token: string,
  params: SlackPostParams,
): Promise<SlackPostResponse> {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })
  return (await res.json()) as SlackPostResponse
}

function slackLink(url: string, text: string): string {
  return `<${url}|${text}>`
}

function formatPreview(game: z.infer<typeof gamePreviewSchema>): string {
  const gameLink = slackLink(game.gameUrl, `${game.firstTeam} vs ${game.secondTeam}`)
  const lines: string[] = [`⚾ *${gameLink}*`, `🕐 ${game.startTime}　🏟️ ${game.venue}`]

  if (game.starters.length > 0) {
    lines.push('')
    lines.push('🔋 *予告先発*')
    for (const s of game.starters) {
      const pitcherLabel = s.pitcherUrl ? slackLink(s.pitcherUrl, s.pitcher) : s.pitcher
      lines.push(`• ${s.team}: ${pitcherLabel}`)
    }
  }

  if (game.preview) {
    lines.push('')
    lines.push(`📝 *見どころ*`)
    lines.push(game.preview)
  }

  return lines.join('\n')
}

export const postPreviewToSlackStep = createStep({
  id: 'post-preview-to-slack',
  description: '試合予告をSlackのチャンネル本文とスレッドに投稿',
  inputSchema: z.array(gamePreviewSchema.nullable()),
  outputSchema: z.object({ message: z.string() }),
  execute: async ({ inputData }) => {
    const token = process.env.SLACK_BOT_TOKEN
    const channel = process.env.SLACK_CHANNEL_ID
    if (!token || !channel) {
      throw new Error('SLACK_BOT_TOKEN または SLACK_CHANNEL_ID が未設定です')
    }

    const dateLabel = formatDateLabel(new Date())

    // null（見どころ未掲載試合）を除外
    const games = inputData.filter((g): g is z.infer<typeof gamePreviewSchema> => g !== null)

    if (games.length === 0) {
      await postSlackMessage(token, {
        channel,
        text: `⚾ 本日 ${dateLabel} の試合予定はありません`,
      })
      return { message: '試合予定なし通知を投稿しました' }
    }

    const mainRes = await postSlackMessage(token, {
      channel,
      text: `⚾ *本日 ${dateLabel} の試合予定をお伝えします！*`,
    })
    if (!mainRes.ok) {
      throw new Error(`Slackメインメッセージ投稿失敗: ${mainRes.error ?? 'unknown'}`)
    }

    for (const game of games) {
      const threadRes = await postSlackMessage(token, {
        channel,
        thread_ts: mainRes.ts,
        text: formatPreview(game),
      })
      if (!threadRes.ok) {
        throw new Error(`試合予告投稿失敗 (${game.gameId}): ${threadRes.error ?? 'unknown'}`)
      }
    }

    return { message: `${games.length}試合の予告をSlackに投稿しました` }
  },
})
