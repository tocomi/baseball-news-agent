import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'

import { formatDateLabel } from '../../utils/date'
import { gameDetailSchema } from './schemas'

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

function formatGame(game: z.infer<typeof gameDetailSchema>): string {
  const scoreText = `${game.firstTeam} ${game.firstTeamScore} - ${game.secondTeamScore} ${game.secondTeam}`
  const gameLink = slackLink(game.gameUrl, scoreText)
  const venuePart = game.venue ? ` 🏟️${game.venue}` : ''
  const lines: string[] = [`⚾ *${gameLink}*${venuePart}`]

  const pitcherParts = [
    game.winningPitcher ? `✅ 勝: ${game.winningPitcher}` : null,
    game.losingPitcher ? `❌ 敗: ${game.losingPitcher}` : null,
    game.savePitcher ? `🛡️ S: ${game.savePitcher}` : null,
  ].filter(Boolean)
  if (pitcherParts.length > 0) lines.push('', pitcherParts.join(' / '))

  if (game.homeRuns.length > 0) {
    const hrText = game.homeRuns
      .map((hr) => `${hr.team} ${hr.player} ${hr.detail.replace(/\(.*\)/, '').trim()}`.trim())
      .join(', ')
    lines.push('', `💣 本塁打: ${hrText}`)
  }

  if (game.review) {
    lines.push('', `📝 ${game.review}`)
  }

  return lines.join('\n')
}

export const postToSlackStep = createStep({
  id: 'post-to-slack',
  description: '試合結果をSlackのチャンネル本文とスレッドに投稿',
  inputSchema: z.object({
    games: z.array(gameDetailSchema.nullable()),
    dateStr: z.string().optional(),
  }),
  outputSchema: z.object({ message: z.string() }),
  execute: async ({ inputData }) => {
    const token = process.env.SLACK_BOT_TOKEN
    const channel = process.env.SLACK_CHANNEL_ID
    if (!token || !channel) {
      throw new Error('SLACK_BOT_TOKEN または SLACK_CHANNEL_ID が未設定です')
    }

    // null（未開始試合）を除外
    const games = inputData.games.filter((g): g is z.infer<typeof gameDetailSchema> => g !== null)

    if (games.length === 0) {
      return { message: '試合なし（投稿スキップ）' }
    }

    const dateLabel = formatDateLabel(new Date())

    // メインメッセージを投稿してスレッドtsを取得
    const mainRes = await postSlackMessage(token, {
      channel,
      text: `⚾ *本日 ${dateLabel} の試合結果をお伝えします！*`,
    })
    if (!mainRes.ok) {
      throw new Error(`Slackメインメッセージ投稿失敗: ${mainRes.error ?? 'unknown'}`)
    }

    // スレッドに各試合の詳細を投稿
    for (const game of games) {
      const threadRes = await postSlackMessage(token, {
        channel,
        thread_ts: mainRes.ts,
        text: formatGame(game),
      })
      if (!threadRes.ok) {
        throw new Error(`試合詳細投稿失敗 (${game.gameId}): ${threadRes.error ?? 'unknown'}`)
      }
    }

    return { message: `${games.length}試合の結果をSlackに投稿しました` }
  },
})
