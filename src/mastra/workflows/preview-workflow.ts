import { createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

import { fetchGamePreviewStep } from './preview/fetch-game-preview-step'
import { fetchPreviewScheduleStep } from './preview/fetch-preview-schedule-step'
import { postPreviewToSlackStep } from './preview/post-preview-to-slack-step'

export const previewWorkflow = createWorkflow({
  id: 'preview-workflow',
  inputSchema: z.object({}),
  outputSchema: z.object({ message: z.string() }),
})
  .then(fetchPreviewScheduleStep)
  .map(async ({ inputData }) => inputData.games)
  .foreach(fetchGamePreviewStep, { concurrency: 3 })
  .then(postPreviewToSlackStep)

previewWorkflow.commit()
