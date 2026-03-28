# baseball-news-agent

NPB の試合情報を Yahoo Baseball からスクレイピングし、Slack に自動投稿する Mastra ワークフローです。

- **試合プレビュー** — 毎朝 9:30 JST に当日の予告先発・見どころを投稿
- **試合結果** — 毎晩 22:00 JST に当日の試合結果をまとめて投稿

GitHub Actions により自動実行されます。

## Setup

```bash
pnpm install
cp .env.sample .env
```

`.env` に以下を設定してください。

| 変数名 | 説明 |
| --- | --- |
| `SLACK_BOT_TOKEN` | Slack Bot User OAuth Token (`xoxb-...`) |
| `SLACK_CHANNEL_ID` | 投稿先チャンネル ID |

GitHub Actions で自動実行する場合は、リポジトリの Secrets に同じ値を登録してください。

## Development

```bash
pnpm dev      # Mastra Studio を起動 (localhost:4111)
pnpm build    # ビルド
pnpm lint:fix # Lint 修正
pnpm format   # フォーマット
```

