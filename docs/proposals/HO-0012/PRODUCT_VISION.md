# Product Vision — Lớp Học Diệu Kỳ: Online School World

**Status:** Draft for challenge  
**Owner:** Nam  
**Project repo:** https://github.com/ntnam2809/lop-hoc-dieu-ky  
**Handoff:** HO-0012  
**Last updated:** 2026-11-06

## Vision

Lớp Học Diệu Kỳ phát triển từ prototype đồ dùng dạy học số thành **2D online social learning world**. Người chơi có thể tham gia trường, gặp gỡ người khác, học qua hoạt động tương tác, và dần trở thành người kiến tạo cộng đồng giáo dục.

Sản phẩm không chỉ là LMS với avatar. World exploration, social belonging, creation và learning đều là các trụ cột.

## Product pillars

1. **Social World:** campus exploration, avatar interaction, friends, clubs, events.
2. **Learning World:** lesson sessions, live classroom, mini-games, assessment and progress.
3. **Creation World:** school/class creation, permissions, campus customization, lesson authoring and community events.

## Audience and school levels

Target model supports kindergarten, elementary, middle/high school and university. Initial vertical slice should focus on kindergarten age 5 because the existing prototype README describes that cohort and already lists story/science lessons. This is a sequencing choice, not a permanent product limitation.

Audience policy, age boundaries, parental involvement and adult/child interaction model require explicit safety and legal review before public launch.

## World model proposal

Proposed hybrid:
- Shared public hub for discovery, world library and inter-school events.
- Separate school campuses with instances/shards.
- Classroom sessions are controlled rooms.
- Cross-school visits governed by school policies and age-appropriate permissions.

The model is a hypothesis to test. Claude should compare simpler alternatives (single campus instance, school-as-room, lobby + session) and recommend the lowest-risk MVP.

## Core organization model

Separate account identity, character/student profile, school membership, school-scoped role grants, class enrollment and subscription entitlements. A user may have different roles in different schools. Principal at School A does not imply global platform admin. Teacher authorization must be scoped and revocable.

## Learning experience

Curriculum → Topic → Lesson → Activity blocks → Assessment → Progress.

Initial patterns: storytelling, quiz, drag-drop, matching, simulation, experiment, puzzle, group mission, presentation and assignment. Existing lesson “Nổi hay chìm?” is a candidate for the first end-to-end lesson journey.

## Social and RPG systems

Candidate features: profile, friends, controlled messaging, clubs, events, portfolio, campus customization, mascot, festivals and world library. Candidate progression currencies: EXP, contribution and cosmetic currency. None should imply intelligence or determine actual academic standing.

Avoid punitive streaks, pay-to-win learning, manipulative monetization and competitive ranking pressure for children.

## Business model hypotheses

Free / Teacher Pro / School Pro tiers could limit creation tools, concurrent classes, storage and administration capacity. Quota examples in HO-0012 are placeholders only. Do not implement payment or commit pricing until unit economics, safeguarding and owner decisions are reviewed. Marketplace and AI lesson authoring are later-stage hypotheses.

## Safety by design

Age-appropriate chat, safe defaults, moderation, reporting, parental controls, teacher authorization, anti-bullying workflows, auditability and data minimization are foundational. Public voice chat is out of MVP. Legal/privacy assessment is required before launch; no unverified compliance claims.

## First vertical slice success criteria

A principal creates a kindergarten school, grants teacher permission, teacher creates a class, student joins, teacher starts an interactive lesson, student participates, and progress is persisted. At least one real 2D campus area and a safe multiplayer interaction model should be demonstrated.

## Non-goals for first slice

No full four-level curriculum, payment, marketplace, voice chat, elaborate economy, mass-generated assets, or microservice split. Preserve the prototype and its content.
