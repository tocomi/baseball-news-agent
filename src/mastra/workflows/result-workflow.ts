import { createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

import { fetchGameDetailStep } from './result/fetch-game-detail-step'
import { fetchScheduleStep } from './result/fetch-schedule-step'
import { postToSlackStep } from './result/post-to-slack-step'

export const resultWorkflow = createWorkflow({
  id: 'result-workflow',
  inputSchema: z.object({ date: z.string().optional() }),
  outputSchema: z.object({ message: z.string() }),
})
  .then(fetchScheduleStep)
  .map(async ({ inputData }) => inputData.games)
  .foreach(fetchGameDetailStep, { concurrency: 3 })
  .map(async ({ inputData, getStepResult }) => ({
    games: inputData,
    dateStr: getStepResult(fetchScheduleStep)?.dateStr,
  }))
  .then(postToSlackStep)

resultWorkflow.commit()
