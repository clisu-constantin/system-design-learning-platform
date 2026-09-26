"""The JSON of the API: the web app's `ConceptProgress`, camelCase, times in ms since the epoch.

Validation matches `isConceptProgress` in src/app/providers/progressState.ts, plus the limits a
server needs (slug shape, at most 1000 Concepts, times that fit a BIGINT).
"""

from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StringConstraints

from app.merge import ConceptProgress, QuizResult

#: At most 2^53 - 1: the largest whole number JavaScript holds exactly, well inside a BIGINT.
Millis = Annotated[int, Field(ge=0, le=2**53 - 1, strict=True)]
Count = Annotated[int, Field(ge=0, le=1_000_000, strict=True)]
Slug = Annotated[str, StringConstraints(pattern=r"^[a-z0-9][a-z0-9-]{0,99}$")]

MAX_CONCEPTS = 1000


class QuizIn(BaseModel):
    correct: Count
    total: Annotated[int, Field(gt=0, le=1_000_000, strict=True)]
    at: Millis


class ConceptProgressIn(BaseModel):
    # camelCase fields: these are the JSON names of the web app, taken as they are.
    # Unknown fields are dropped, as `cleanRecord` does in the browser, so a newer client still syncs.
    model_config = ConfigDict(extra="ignore")

    done: StrictBool
    doneAt: Millis
    changedAt: Millis
    visitedAt: Millis | None = None
    quiz: QuizIn | None = None
    clearedAt: Millis | None = None

    def to_domain(self) -> ConceptProgress:
        quiz = self.quiz
        return ConceptProgress(
            done=self.done,
            done_at=self.doneAt,
            changed_at=self.changedAt,
            visited_at=self.visitedAt,
            quiz=QuizResult(correct=quiz.correct, total=quiz.total, at=quiz.at) if quiz else None,
            cleared_at=self.clearedAt,
        )


class ProgressIn(BaseModel):
    concepts: Annotated[dict[Slug, ConceptProgressIn], Field(max_length=MAX_CONCEPTS)]


def to_json(record: ConceptProgress) -> dict[str, Any]:
    """A record as the web app reads it: optional fields are omitted, never null."""
    body: dict[str, Any] = {"done": record.done, "doneAt": record.done_at, "changedAt": record.changed_at}
    if record.visited_at is not None:
        body["visitedAt"] = record.visited_at
    if record.quiz is not None:
        body["quiz"] = {"correct": record.quiz.correct, "total": record.quiz.total, "at": record.quiz.at}
    if record.cleared_at is not None:
        body["clearedAt"] = record.cleared_at
    return body
