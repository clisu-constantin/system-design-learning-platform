# System Design Interactive

A browser-only app where a junior developer learns system design by changing a simulation and
watching the outcome change.

## Language

### Learning content

**Concept**:
One system design idea with its own page. The unit the learner studies and completes. Every Concept has
four tabs - Diagram, Lab, Trade-offs, Quiz - and a Lesson under its Diagram.
_Avoid_: Lesson, topic, page

**Category**:
A named group of Concepts, such as Scaling or Caching. Every Concept belongs to exactly one.
_Avoid_: Section, module, chapter

**Lesson**:
The long-form written explanation of one Concept, shown in the Diagram tab, under the Diagram. It is
not a tab of its own.
_Avoid_: Deep dive, article

**Diagram**:
The running picture of one Concept: its parts and the traffic that flows between them. The first thing a Concept shows.
_Avoid_: Visual, flow, animation

**Walkthrough**:
The ordered steps of a Diagram, one hop at a time, each with a caption of six words or fewer. Shown on the same Diagram, not beside it. Every Concept has one.
_Avoid_: Step by step, sequence, tour

**Lab**:
An interactive simulation the learner drives with controls. It always shows the system as parts and
wires with traffic moving on them; a chart or a timeline may sit beside that picture, never replace it.
Every Concept hosts exactly one Lab. One Lab can be hosted by several Concepts, and it also has a page
of its own.
_Avoid_: Demo, exercise, widget

**Lab focus**:
The starting setup a shared Lab opens with on one Concept, so it shows that Concept's lesson first.
Retry and Exponential backoff share a Lab; each opens it with a different focus.
_Avoid_: Preset, mode, scenario

**Trade-offs**:
What each approach to a Concept gains and what it costs. Never "X is better than Y".
_Avoid_: Pros and cons, comparison

**Quiz**:
The scenario questions that check one Concept - at least ten, and more when ten cannot cover it.
Passing it with 70% or more makes the Concept Done.
_Avoid_: Test, exam, questions

### Tools

**Tools**:
The six pages that sit above the Categories in the sidebar: Interactive Labs, Playground, System
Evolution, Compare Mode, Scenarios and Glossary. They are not tied to one Concept.
_Avoid_: Workspace, features, sections

**Playground**:
The free-build canvas where the learner adds parts, wires them and runs traffic to see what breaks.
Unlike a Lab, it has no set lesson and no fixed parts.
_Avoid_: Sandbox, editor, builder

### Progress

**Done**:
A Concept the learner marked complete or whose quiz they passed with 70% or more. Opening a Concept does not make it Done.
_Avoid_: Finished, learned, visited

## Flagged ambiguities

- "Learning path" (an ordered list of Concepts to follow) was discussed on 2026-09-23 and deferred.
  No Concept has a set order or prerequisites today.
