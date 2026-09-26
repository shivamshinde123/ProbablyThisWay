import { randomUUID } from "node:crypto";
import {
  decisionEventSchema,
  latestDecisionSchema,
  stateUpdateResponseSchema,
  type HikeDetail,
  type HikingState,
  type StateUpdateResponse,
} from "@probably-this-way/contracts";
import { evaluateRoutes } from "./evaluation.js";
import { selectRouteRecommendation } from "./policy.js";
import type { SessionRecord, SessionStore } from "./session-store.js";
import { detectRelevantThresholds } from "./thresholds.js";

export type SessionStateTransition =
  | { status: "accepted"; response: StateUpdateResponse }
  | { status: "conflict" }
  | { status: "stale" };

export async function transitionSessionState(options: {
  record: SessionRecord;
  nextState: HikingState;
  hike: HikeDetail;
  sessionStore: SessionStore;
}): Promise<SessionStateTransition> {
  const { record, nextState, hike, sessionStore } = options;
  if (Date.parse(nextState.observedAt) <= Date.parse(record.session.state.observedAt)) {
    return { status: "stale" };
  }

  const crossedThresholds = detectRelevantThresholds(record.lastEvaluatedState, nextState);
  const expectedSequence = record.sequence;
  record.sequence = expectedSequence + 1;
  record.session = { ...record.session, state: nextState };

  if (crossedThresholds.length === 0) {
    if (!(await sessionStore.save(record, expectedSequence))) return { status: "conflict" };
    return {
      status: "accepted",
      response: stateUpdateResponseSchema.parse({
        accepted: true,
        evaluationQueued: false,
        reason: "no_relevant_threshold_crossed",
        sequence: record.sequence,
        crossedThresholds,
      }),
    };
  }

  const evaluation = await evaluateRoutes({
    sessionId: record.session.id,
    state: nextState,
    routes: hike.routes,
  });
  const recommendation = selectRouteRecommendation(evaluation, hike.routes, nextState);
  const decision = latestDecisionSchema.parse({ evaluation, recommendation });

  record.decision = decision;
  record.lastEvaluatedState = nextState;
  record.eventSequence += 1;
  record.events.push(decisionEventSchema.parse({
    id: randomUUID(),
    sessionId: record.session.id,
    sequence: record.eventSequence,
    type: "recommendation_updated",
    occurredAt: decision.recommendation.decidedAt,
    state: nextState,
    decision,
    crossedThresholds,
  }));
  if (!(await sessionStore.save(record, expectedSequence))) return { status: "conflict" };

  return {
    status: "accepted",
    response: stateUpdateResponseSchema.parse({
      accepted: true,
      evaluationQueued: true,
      reason: "relevant_threshold_crossed",
      sequence: record.sequence,
      crossedThresholds,
      decision,
    }),
  };
}
