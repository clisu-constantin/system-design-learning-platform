"""The merge rules of `mergeConcept` in src/app/providers/progressState.ts, checked on the Python port."""

import itertools

from app.merge import ConceptProgress, QuizResult, merge_concept, merge_progress


def record(
    done: bool = False,
    done_at: int = 0,
    changed_at: int = 0,
    visited_at: int | None = None,
    quiz: QuizResult | None = None,
    cleared_at: int | None = None,
) -> ConceptProgress:
    return ConceptProgress(
        done=done,
        done_at=done_at,
        changed_at=changed_at,
        visited_at=visited_at,
        quiz=quiz,
        cleared_at=cleared_at,
    )


# Done: the latest change wins.


def test_a_later_done_wins_over_an_older_not_done() -> None:
    older = record(done=False, done_at=100, changed_at=100)
    newer = record(done=True, done_at=200, changed_at=200)
    assert merge_concept(older, newer).done is True
    assert merge_concept(newer, older).done is True


def test_un_marking_wins_over_an_older_done() -> None:
    marked = record(done=True, done_at=100, changed_at=100)
    unmarked = record(done=False, done_at=200, changed_at=200)
    merged = merge_concept(marked, unmarked)
    assert merged.done is False
    assert merged.done_at == 200
    assert merge_concept(unmarked, marked) == merged


def test_done_wins_a_tie() -> None:
    done = record(done=True, done_at=100, changed_at=100)
    not_done = record(done=False, done_at=100, changed_at=100)
    assert merge_concept(done, not_done).done is True
    assert merge_concept(not_done, done).done is True


def test_changed_at_is_the_latest_of_both() -> None:
    assert merge_concept(record(changed_at=5), record(changed_at=9)).changed_at == 9


# Quiz: the best score is kept.


def test_a_higher_score_replaces_a_lower_one_and_a_lower_never_replaces_a_higher() -> None:
    low = record(quiz=QuizResult(correct=5, total=10, at=300))
    high = record(quiz=QuizResult(correct=9, total=10, at=100))
    assert merge_concept(low, high).quiz == QuizResult(correct=9, total=10, at=100)
    assert merge_concept(high, low).quiz == QuizResult(correct=9, total=10, at=100)


def test_a_score_tie_keeps_the_later_attempt_then_the_longer_quiz() -> None:
    earlier = QuizResult(correct=7, total=10, at=100)
    later = QuizResult(correct=7, total=10, at=200)
    assert merge_concept(record(quiz=earlier), record(quiz=later)).quiz == later
    assert merge_concept(record(quiz=later), record(quiz=earlier)).quiz == later

    short = QuizResult(correct=7, total=10, at=100)
    long = QuizResult(correct=14, total=20, at=100)
    assert merge_concept(record(quiz=short), record(quiz=long)).quiz == long
    assert merge_concept(record(quiz=long), record(quiz=short)).quiz == long


def test_a_quiz_on_one_side_only_is_kept() -> None:
    quiz = QuizResult(correct=3, total=10, at=100)
    assert merge_concept(record(), record(quiz=quiz)).quiz == quiz
    assert merge_concept(record(quiz=quiz), record()).quiz == quiz


# Visit: the earliest first visit.


def test_the_earliest_visit_is_kept() -> None:
    assert merge_concept(record(visited_at=300), record(visited_at=100)).visited_at == 100
    assert merge_concept(record(), record(visited_at=100)).visited_at == 100
    assert merge_concept(record(), record()).visited_at is None


# Reset: "cleared at" records.


def test_a_reset_beats_older_visits_and_scores() -> None:
    old = record(
        done=True, done_at=100, changed_at=100, visited_at=50, quiz=QuizResult(correct=9, total=10, at=100)
    )
    cleared = record(done=False, done_at=500, changed_at=500, cleared_at=500)
    merged = merge_concept(old, cleared)
    assert merged == record(done=False, done_at=500, changed_at=500, cleared_at=500)
    assert merge_concept(cleared, old) == merged


def test_progress_after_the_reset_is_kept() -> None:
    cleared = record(done=False, done_at=500, changed_at=500, cleared_at=500)
    after = record(
        done=True,
        done_at=700,
        changed_at=700,
        visited_at=600,
        quiz=QuizResult(correct=8, total=10, at=700),
        cleared_at=500,
    )
    merged = merge_concept(cleared, after)
    assert merged.done is True
    assert merged.visited_at == 600
    assert merged.quiz == QuizResult(correct=8, total=10, at=700)
    assert merged.cleared_at == 500


def test_a_done_after_the_reset_survives_even_from_a_device_that_missed_the_reset() -> None:
    cleared = record(done=False, done_at=500, changed_at=500, cleared_at=500)
    later_done = record(done=True, done_at=800, changed_at=800, visited_at=100)
    merged = merge_concept(cleared, later_done)
    assert merged.done is True
    assert merged.done_at == 800
    # The visit came from the side that had not seen the Reset, so it does not count.
    assert merged.visited_at is None
    assert merged.cleared_at == 500


def test_the_latest_reset_is_kept() -> None:
    assert merge_concept(record(cleared_at=100), record(cleared_at=300)).cleared_at == 300
    assert merge_concept(record(cleared_at=100), record()).cleared_at == 100


# Order independence.

SAMPLES = [
    record(),
    record(done=True, done_at=100, changed_at=100, visited_at=90),
    record(done=False, done_at=200, changed_at=200, visited_at=50),
    record(done=True, done_at=200, changed_at=250, quiz=QuizResult(correct=7, total=10, at=250)),
    record(done=False, done_at=300, changed_at=300, cleared_at=300),
    record(
        done=True,
        done_at=400,
        changed_at=400,
        visited_at=350,
        quiz=QuizResult(correct=14, total=20, at=250),
        cleared_at=300,
    ),
    record(
        done=False, done_at=150, changed_at=500, visited_at=10, quiz=QuizResult(correct=10, total=10, at=5)
    ),
    record(done=False, done_at=600, changed_at=600, cleared_at=600),
]


def test_the_merge_is_commutative() -> None:
    for a, b in itertools.product(SAMPLES, repeat=2):
        assert merge_concept(a, b) == merge_concept(b, a)


def test_the_merge_is_associative() -> None:
    for a, b, c in itertools.product(SAMPLES, repeat=3):
        assert merge_concept(merge_concept(a, b), c) == merge_concept(a, merge_concept(b, c))


# Whole progress.


def test_ten_done_in_the_account_and_five_others_on_a_guest_device_give_fifteen() -> None:
    account = {f"account-{n}": record(done=True, done_at=1000 + n, changed_at=1000 + n) for n in range(10)}
    guest = {f"guest-{n}": record(done=True, done_at=2000 + n, changed_at=2000 + n) for n in range(5)}
    merged = merge_progress(account, guest)
    assert sum(1 for progress in merged.values() if progress.done) == 15
    assert merge_progress(guest, account) == merged


def test_a_concept_on_one_side_only_is_kept_as_it_is() -> None:
    only = record(done=True, done_at=5, changed_at=5, visited_at=1)
    assert merge_progress({}, {"cache": only}) == {"cache": only}
    assert merge_progress({"cache": only}, {}) == {"cache": only}
