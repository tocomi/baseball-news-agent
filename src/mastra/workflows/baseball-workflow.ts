import { createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

import { fetchGameDetailStep } from './baseball/fetch-game-detail-step'
import { fetchScheduleStep } from './baseball/fetch-schedule-step'
import { postToSlackStep } from './baseball/post-to-slack-step'

export const baseballWorkflow = createWorkflow({
  id: 'baseball-workflow',
  inputSchema: z.object({}),
  outputSchema: z.object({ message: z.string() }),
})
  .then(fetchScheduleStep)
  .map(async ({ inputData }) => inputData.games)
  .foreach(fetchGameDetailStep, { concurrency: 3 })
  .then(postToSlackStep)

baseballWorkflow.commit()
