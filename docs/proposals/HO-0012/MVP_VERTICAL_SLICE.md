# MVP Vertical Slice — Kindergarten Online School

**Status:** Proposed scope for Claude review.

## Goal

Demonstrate a complete end-to-end journey for one kindergarten school, while retaining the product's longer-term school-world vision.

## Included

- One small 2D campus with gate, yard and two classroom spaces.
- Basic avatar movement and controlled interactions.
- Account/profile needed for the journey.
- Create school and become principal.
- Principal grants/revokes teacher role.
- Teacher creates a class and sets capacity.
- Student joins school/class subject to policy.
- Teacher starts and ends a lesson session.
- At least one existing lesson pattern/content item is integrated.
- Student answers/interacts.
- Progress/result is persisted and visible to authorized teacher.
- Basic safety controls, moderation/report path and audit for privileged actions.
- Local development, automated build/test and deployment path.

## Suggested first lesson

“Nổi hay chìm?”:
1. Teacher introduces several objects.
2. Students predict floating/sinking.
3. Students manipulate objects in a simple simulation.
4. System reveals outcomes.
5. Students answer a comprehension prompt.
6. Session records participation/result.

Claude must inspect actual assets/content implementation and determine whether this lesson is reusable without rewrite.

## Explicitly excluded

- Full kindergarten curriculum.
- Elementary/middle/high school/university features.
- Paid subscription and payment gateway.
- Marketplace.
- AI-generated lesson publishing.
- Voice chat.
- Global ranking.
- Large-scale MMO infrastructure.
- Full campus builder.
- Cross-school festival system.
- Mobile native app.

## Acceptance journey

1. A creates School A.
2. A grants teacher authorization to B.
3. B creates Class 01 with a capacity.
4. C discovers School A and enrolls in Class 01.
5. B creates a live session.
6. C joins the session.
7. B launches the “Float or Sink?” lesson.
8. C submits at least one prediction/interaction/answer.
9. Server persists the session result/progress.
10. B can inspect progress; unauthorized users cannot inspect C's private data.

## Non-functional acceptance

- A reconnecting student can recover session state or receives a clear failure state.
- A student cannot invoke teacher/principal actions.
- One school's teacher cannot administer another school's classes.
- Chat and interaction events have rate limits.
- No secret committed; environment example is safe.
- Existing public prototype deployment is not broken during migration.
- Test/build commands are documented and pass.

## Scope adjustment rule

If realtime multiplayer is too expensive for the first increment, Claude may propose a two-step proof:
1. A technical spike proving multi-client presence and movement.
2. School/class/lesson flow integrated after the spike.

It must clearly state what value is delayed and why.
