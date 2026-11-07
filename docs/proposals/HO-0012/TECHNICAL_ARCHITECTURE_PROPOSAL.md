# Technical Architecture — Proposal for Review

**Status:** Hypothesis; not an implementation mandate.

## Guiding principles

- Preserve the existing prototype and learning materials.
- Prefer a vertical slice over a broad platform rewrite.
- Modular monolith before microservices unless measured requirements justify extraction.
- Server authority for trusted multiplayer/session outcomes.
- Keep account identity, game character, school membership and class enrollment separate.
- Treat child safety and data privacy as architecture concerns.

## Candidate client architecture

- 2D renderer/engine candidate: Phaser 3 + TypeScript.
- React for admin dashboards, teacher tools, chat panels and content authoring UI.
- Assess integration, bundle size, accessibility, mobile touch, scene lifecycle, testing and deployment fit before selection.
- Do not select the engine solely because it appeared in the initial proposal.

## Candidate backend modules

Identity/profile; school/membership; role/permission; class/enrollment; learning content/progress; live classroom/session; world/instance/presence; subscription entitlement (not payment in MVP); moderation/safety.

A modular monolith is the initial hypothesis. Realtime transport may be a separate process only if operational needs justify it.

## Candidate multiplayer model

- WebSocket or a managed realtime platform.
- Campus instances cap concurrent players.
- Classroom session is a distinct room with controlled membership.
- Server validates movement boundaries, session state, teacher controls, answers/results and rewards.
- Clients may predict local movement for responsiveness, but must not decide authoritative progress.
- Define reconnect, heartbeat, rate limits, backpressure, room capacity and abuse controls.

Claude should compare managed services and self-hosted options with cost/operational tradeoffs.

## Candidate data domains

User, CharacterProfile, School, SchoolMembership, RoleGrant, Class, ClassEnrollment, Curriculum, Lesson, LessonBlock, LessonSession, SessionParticipant, StudentProgress, Message, Friendship, Event, Asset, SubscriptionEntitlement, ModerationReport, AuditEvent.

Use stable IDs, timestamps, ownership scopes and explicit deletion/retention policies. Avoid designing the full schema before validating MVP journeys.

## Security and safety

- Least-privilege authorization on every school/class operation.
- Prevent school owner escalation and teacher permission leakage across tenants.
- Rate-limit chat and interaction events.
- Validate lesson content and uploaded files.
- Record security-relevant admin actions.
- Design report/block/moderation flows before enabling user-generated chat.
- Minimize personal data; never expose student email/phone/location to other players.
- Plan for parent/guardian controls and child account management.
- Perform jurisdiction-specific privacy/legal assessment before external launch.

## Observability and operations

Track concurrent users per instance, reconnect rate, message throughput, latency, session completion, failed lesson submissions, moderation queue and database/storage cost. Logs must avoid collecting unnecessary child personal data.

## ADRs required before meaningful implementation

1. Engine and rendering model.
2. Client/UI integration.
3. Backend framework and database.
4. Realtime transport and authority model.
5. World/instance topology.
6. Authentication and child/guardian model.
7. Content schema/versioning.
8. Hosting/deployment and cost envelope.
9. Moderation and retention.
10. Existing prototype/content migration.

## Initial repository structure (illustrative)

docs/; apps/game-client/; apps/school-admin/; apps/teacher-dashboard/; services/api/; services/realtime/; services/content-engine/; packages/shared-types/; packages/lesson-patterns/; content/; assets/; archive/prototype/.

Do not create empty folders solely to match this illustration. Adopt structure based on the actual repo and vertical slice.
