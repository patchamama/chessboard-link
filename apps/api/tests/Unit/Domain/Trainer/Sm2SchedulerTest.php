<?php

declare(strict_types=1);

namespace App\Tests\Unit\Domain\Trainer;

use App\Domain\Trainer\ReviewGrade;
use App\Domain\Trainer\Sm2Scheduler;
use App\Domain\Trainer\SrsState;
use PHPUnit\Framework\TestCase;

final class Sm2SchedulerTest extends TestCase
{
    private Sm2Scheduler $scheduler;
    private \DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->scheduler = new Sm2Scheduler();
        $this->now       = new \DateTimeImmutable('2026-06-15 12:00:00');
    }

    private function fresh(): SrsState
    {
        return new SrsState(ease: 2.5, intervalDays: 0, reps: 0, lapses: 0);
    }

    public function test_first_good_review_sets_interval_to_one_day(): void
    {
        $next = $this->scheduler->review($this->fresh(), ReviewGrade::Good, $this->now);

        $this->assertSame(1, $next->state->intervalDays);
        $this->assertSame(1, $next->state->reps);
        $this->assertSame(0, $next->state->lapses);
        $this->assertEquals(
            $this->now->modify('+1 day'),
            $next->dueAt,
        );
    }

    public function test_second_good_review_sets_interval_to_six_days(): void
    {
        $afterFirst = $this->scheduler->review($this->fresh(), ReviewGrade::Good, $this->now)->state;
        $next       = $this->scheduler->review($afterFirst, ReviewGrade::Good, $this->now);

        $this->assertSame(6, $next->state->intervalDays);
        $this->assertSame(2, $next->state->reps);
    }

    public function test_third_good_review_multiplies_interval_by_ease(): void
    {
        $s = $this->fresh();
        $s = $this->scheduler->review($s, ReviewGrade::Good, $this->now)->state; // 1
        $s = $this->scheduler->review($s, ReviewGrade::Good, $this->now)->state; // 6
        $next = $this->scheduler->review($s, ReviewGrade::Good, $this->now);

        // 6 * ease (2.5) = 15
        $this->assertSame(15, $next->state->intervalDays);
        $this->assertSame(3, $next->state->reps);
    }

    public function test_again_resets_interval_and_counts_a_lapse(): void
    {
        $s = $this->fresh();
        $s = $this->scheduler->review($s, ReviewGrade::Good, $this->now)->state; // reps 1, interval 6 path
        $s = $this->scheduler->review($s, ReviewGrade::Good, $this->now)->state; // interval 6

        $next = $this->scheduler->review($s, ReviewGrade::Again, $this->now);

        $this->assertSame(0, $next->state->reps);
        $this->assertSame(1, $next->state->intervalDays); // relearn next day
        $this->assertSame(1, $next->state->lapses);
        // due the same day (short relearn step) or next day
        $this->assertEquals($this->now->modify('+1 day'), $next->dueAt);
    }

    public function test_easy_grade_increases_ease_more_than_good(): void
    {
        $good = $this->scheduler->review($this->fresh(), ReviewGrade::Good, $this->now)->state;
        $easy = $this->scheduler->review($this->fresh(), ReviewGrade::Easy, $this->now)->state;

        $this->assertGreaterThan($good->ease, $easy->ease);
    }

    public function test_hard_grade_decreases_ease(): void
    {
        $hard = $this->scheduler->review($this->fresh(), ReviewGrade::Hard, $this->now)->state;
        $this->assertLessThan(2.5, $hard->ease);
    }

    public function test_ease_never_drops_below_floor(): void
    {
        $s = $this->fresh();
        for ($i = 0; $i < 20; $i++) {
            $s = $this->scheduler->review($s, ReviewGrade::Again, $this->now)->state;
        }
        $this->assertGreaterThanOrEqual(1.3, $s->ease);
    }
}
