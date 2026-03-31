/**
 * ML Worker — risk scoring and intelligent suggestions (Sprint 2)
 *
 * Placeholder — scaffolded to the full WorkerBus protocol so Sprint 2 implementation
 * has zero architectural setup cost.
 *
 * Sprint 2 will implement:
 *   - SCORE_RISKS: ML inference over project graphs → RiskScore[]
 *   - SUGGEST_TIMELINE: constraint satisfaction → timeline recommendation
 *   - ANOMALY_DETECT: statistical outlier detection on work item velocity
 */

import type { BusMessage, BusResponse, RiskScoreRequest, RiskScore, InboundMessage } from './types'

function reply<D>(response: BusResponse<D>): void {
  self.postMessage(response)
}

self.onmessage = (e: MessageEvent<InboundMessage>) => {
  const msg = e.data

  if (msg.type === 'CANCEL') return

  const busMsg = msg as BusMessage

  switch (busMsg.type) {
    case 'SCORE_RISKS': {
      const { correlationId, payload } = busMsg as BusMessage<RiskScoreRequest>

      // TODO (Sprint 2): Replace stub with TensorFlow.js or ONNX inference
      const stubScores: RiskScore[] = payload.projectIds.map(id => ({
        projectId:  id,
        score:      Math.random(),
        confidence: 0.85,
        factors:    ['schedule_variance', 'resource_contention'],
      }))

      reply<RiskScore[]>({ correlationId, kind: 'result', data: stubScores })
      break
    }

    default:
      console.warn(`[ml.worker] Unknown message type: ${busMsg.type}`)
  }
}
