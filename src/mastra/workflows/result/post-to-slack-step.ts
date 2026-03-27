import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'

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
  const lines: string[] = [`⚾ *${gameLink}*`]

  if (game.winningPitcher) lines.push(`✅ 勝: ${game.winningPitcher}`)
  if (game.losingPitcher) lines.push(`❌ 敗: ${game.losingPitcher}`)
  if (game.savePitcher) lines.push(`🛡️ S: ${game.savePitcher}`)

  if (game.homeRuns.length > 0) {
    const hrText = game.homeRuns
      .map((hr) => `${hr.team} ${hr.player} ${hr.detail}`.trim())
      .join(', ')
    lines.push(`💣 本塁打: ${hrText}`)
  }

  if (game.review) {
    lines.push('', `📝 ${game.review}`)
  }

  return lines.join('\n')
}

export const postToSlackStep = createStep({
  id: 'post-to-slack',
  description: '試合結果をSlackのチャンネル本文とスレッドに投稿',
  inputSchema: z.array(gameDetailSchema.nullable()),
  outputSchema: z.object({ message: z.string() }),
  execute: async ({ inputData }) => {
    const token = process.env.SLACK_BOT_TOKEN
    const channel = process.env.SLACK_CHANNEL_ID
    if (!token || !channel) {
      throw new Error('SLACK_BOT_TOKEN または SLACK_CHANNEL_ID が未設定です')
    }

    // null（未開始試合）を除外
    const games = inputData.filter((g): g is z.infer<typeof gameDetailSchema> => g !== null)

    const today = new Date()
    const dateStr = `${today.getMonth() + 1}月${today.getDate()}日`

    if (games.length === 0) {
      await postSlackMessage(token, { channel, text: `⚾ ${dateStr} 本日は試合はありません` })
      return { message: '試合なし通知を投稿しました' }
    }

    // メインメッセージを投稿してスレッドtsを取得
    const mainRes = await postSlackMessage(token, {
      channel,
      text: `⚾ ${dateStr} プロ野球速報です（${games.length}試合）`,
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
