"""The progress merge of an Account: a port of `mergeConcept` in src/app/providers/progressState.ts.

The web app and the server must end on the same records whatever order devices sync in, so the
rules here are the TypeScript ones, line for line - change both together. Pure functions only.
"""

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from functools import reduce


@dataclass(frozen=True, slots=True)
class QuizResult:
    correct: int
    total: int
    at: int


@dataclass(frozen=True, slots=True)
class ConceptProgress:
    """One Concept of one Learner. Times are ms since the epoch, as in the browser."""

    done: bool
    #: Time Done was last set or cleared - un-marking keeps the record instead of deleting it.
    done_at: int
    #: Time of the last change of any kind.
    changed_at: int
    #: Time of the first visit.
    visited_at: int | None = None
    #: The best result, not the latest.
    quiz: QuizResult | None = None
    #: Time of the last Reset: a visit or a quiz from before it no longer counts.
    cleared_at: int | None = None


def _best_quiz(a: QuizResult | None, b: QuizResult | None) -> QuizResult | None:
    """The better score; on a tie, the later attempt, then the longer quiz - so the order never matters.

    The ratio is a float division, exactly as in JavaScript, so both sides agree on every tie.
    """
    if a is None or b is None:
        return a if a is not None else b
    order = (b.correct / b.total - a.correct / a.total) or (b.at - a.at) or (b.total - a.total)
    return b if order > 0 else a


def _earliest(a: int | None, b: int | None) -> int | None:
    if a is None or b is None:
        return a if a is not None else b
    return min(a, b)


def _since(side: ConceptProgress) -> float:
    return side.cleared_at if side.cleared_at is not None else float("-inf")


def merge_concept(a: ConceptProgress, b: ConceptProgress) -> ConceptProgress:
    """Two records of one Concept as one: the latest change to Done wins (Done on a tie), the best
    quiz score and the first visit are kept.

    A Reset starts visits and the quiz over, and only the side(s) with the latest Reset count for
    them: a record keeps only its first visit and best score, so it cannot tell which came after a
    Reset it did not see. Dropping that whole side keeps the merge the same in any order and
    grouping. Done has its own time, and a Reset sets it too, so a later Done survives.
    """
    done_from = b if b.done_at > a.done_at or (b.done_at == a.done_at and b.done) else a
    last_reset = max(_since(a), _since(b))
    counted = [side for side in (a, b) if _since(side) == last_reset]
    cleared = [side.cleared_at for side in (a, b) if side.cleared_at is not None]
    return ConceptProgress(
        done=done_from.done,
        done_at=done_from.done_at,
        changed_at=max(a.changed_at, b.changed_at),
        visited_at=_fold(_earliest, [side.visited_at for side in counted]),
        quiz=_fold(_best_quiz, [side.quiz for side in counted]),
        cleared_at=max(cleared) if cleared else None,
    )


def _fold[T](combine: Callable[[T | None, T | None], T | None], values: list[T | None]) -> T | None:
    return reduce(combine, values)


def merge_progress(
    a: Mapping[str, ConceptProgress], b: Mapping[str, ConceptProgress]
) -> dict[str, ConceptProgress]:
    """Every Concept of two sides as one; a Concept on one side only is kept as it is."""
    merged = dict(a)
    for slug, progress in b.items():
        other = merged.get(slug)
        merged[slug] = merge_concept(other, progress) if other is not None else progress
    return merged
