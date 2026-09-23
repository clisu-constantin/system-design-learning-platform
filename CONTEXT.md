# System Design Interactive

A browser-only app where a junior developer learns system design by changing a simulation and
watching the outcome change.

## Language

### Learning content

**Concept**:
One system design idea with its own page, diagram and quiz. The unit the learner studies and completes.
_Avoid_: Lesson, topic, page

**Category**:
A named group of Concepts, such as Scaling or Caching. Every Concept belongs to exactly one.
_Avoid_: Section, module, chapter

**Lesson**:
The long-form written explanation of one Concept, shown in its "Full explanation" tab.
_Avoid_: Deep dive, article

**Diagram**:
The running picture of one Concept: its parts and the traffic that flows between them. The first thing a Concept shows.
_Avoid_: Visual, flow, animation

**Walkthrough**:
The ordered steps of a Diagram, one hop at a time, each with a caption of six words or fewer. Shown on the same Diagram, not beside it. Most Concepts do not have one.
_Avoid_: Step by step, sequence, tour

**Lab**:
An interactive simulation the learner drives with controls. A Concept may host one.
_Avoid_: Demo, exercise, widget

### Progress

**Done**:
A Concept the learner marked complete or whose quiz they passed with 70% or more. Opening a Concept does not make it Done.
_Avoid_: Finished, learned, visited

## Flagged ambiguities

- "Learning path" (an ordered list of Concepts to follow) was discussed on 2026-09-23 and deferred.
  No Concept has a set order or prerequisites today.
