/**
 * Risk Worker — cascade propagation simulation (Sprint 3)
 *
 * Placeholder — scaffolded to the full WorkerBus protocol so Sprint 3 implementation
 * has zero architectural setup cost.
 *
 * Sprint 3 will implement:
 *   - PROPAGATE_RISK: BFS/DFS graph traversal streaming affected nodes as ticks
 *     (each tick = one node's risk level updated, animating the cascade visually)
 *   - COMPUTE_CRITICAL_PATH: CPM analysis → critical path node IDs
 */

import type { BusMessage, BusResponse, PropagationRequest, PropagationTick, InboundMessage } from './types'

function reply<D>(response: BusResponse<D>): void {
  self.postMessage(response)
}

let activeStreamId: string | null = null

self.onmessage = (e: MessageEvent<InboundMessage>) => {
  const msg = e.data

  if (msg.type === 'CANCEL') {
    if (activeStreamId === msg.correlationId) activeStreamId = null
    return
  }

  const busMsg = msg as BusMessage

  switch (busMsg.type) {
    case 'PROPAGATE_RISK': {
      const { correlationId, payload } = busMsg as BusMessage<PropagationRequest>
      activeStreamId = correlationId

      // TODO (Sprint 3): Replace stub with real BFS traversal over graph
      const stubNodes = payload.graphSnapshot.nodes.slice(0, 5)
      let depth = 0

      function nextNode(): void {
        if (activeStreamId !== correlationId) return
        if (depth >= stubNodes.length) {
          reply({ correlationId, kind: 'complete' })
          activeStreamId = null
          return
        }

        const tick: PropagationTick = {
          affectedNodeId: stubNodes[depth].id,
          riskLevel:      depth < 2 ? 'high' : 'medium',
          depth,
        }

        reply<PropagationTick>({ correlationId, kind: 'tick', data: tick })
        depth++
        setTimeout(nextNode, 120) // Simulate propagation delay for animation
      }

      nextNode()
      break
    }

    default:
      console.warn(`[risk.worker] Unknown message type: ${busMsg.type}`)
  }
}
