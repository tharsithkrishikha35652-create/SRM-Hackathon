"""
Unit Tests for MessMate Risk-Score Engine Formula & Logic
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import math
from datetime import datetime, timedelta, timezone
from app.risk_engine import (
    calculate_recurrence_points,
    calculate_delay_points,
    calculate_risk_score,
    determine_risk_level,
    should_escalate,
    get_calendar_week_key
)

def test_recurrence_points():
    # 0 or 1 week -> 0 pts
    assert calculate_recurrence_points(0) == 0
    assert calculate_recurrence_points(1) == 0
    # 2 weeks -> 15 pts
    assert calculate_recurrence_points(2) == 15
    # 3 weeks -> 30 pts
    assert calculate_recurrence_points(3) == 30
    # 4 weeks -> 45 pts
    assert calculate_recurrence_points(4) == 45
    # 5+ weeks -> 45 pts (capped at 45)
    assert calculate_recurrence_points(5) == 45
    assert calculate_recurrence_points(10) == 45

def test_weekly_deduplication():
    # Simulate 100 submissions in the same week
    start = datetime(2026, 10, 19, 10, 0, 0, tzinfo=timezone.utc) # Monday
    week_keys = set()
    for i in range(100):
        t = start + timedelta(hours=i % 120) # all within Monday-Friday of same week
        week_keys.add(get_calendar_week_key(t))
    # All 100 submissions map to the same single calendar week
    assert len(week_keys) == 1
    assert calculate_recurrence_points(len(week_keys)) == 0

def test_delay_points_within_deadline():
    t0 = datetime(2026, 10, 20, 12, 0, 0, tzinfo=timezone.utc)
    
    # 12 hours after report: before deadline -> 0 delay
    t_12h = t0 + timedelta(hours=12)
    pts, overdue, hrs = calculate_delay_points(t0, now_dt=t_12h)
    assert pts == 0
    assert not overdue

    # 23 hours: before deadline -> 0 delay
    t_23h = t0 + timedelta(hours=23)
    pts, overdue, hrs = calculate_delay_points(t0, now_dt=t_23h)
    assert pts == 0
    assert not overdue

    # Exactly 24 hours: on deadline -> 0 delay
    t_24h = t0 + timedelta(hours=24)
    pts, overdue, hrs = calculate_delay_points(t0, now_dt=t_24h)
    assert pts == 0
    assert not overdue

def test_delay_points_after_deadline():
    t0 = datetime(2026, 10, 20, 12, 0, 0, tzinfo=timezone.utc)
    
    # Exceeded by 1 second (24 hours + 1 sec) -> initial 10 pts
    t_just_over = t0 + timedelta(hours=24, seconds=1)
    pts, overdue, hrs = calculate_delay_points(t0, now_dt=t_just_over)
    assert overdue is True
    assert pts == 10

    # 25 hours total (1h overdue) -> 10 pts
    t_25h = t0 + timedelta(hours=25)
    pts, overdue, hrs = calculate_delay_points(t0, now_dt=t_25h)
    assert pts == 10

    # 48 hours total (24 complete hours overdue) -> 10 + 5 = 15 pts
    t_48h = t0 + timedelta(hours=48)
    pts, overdue, hrs = calculate_delay_points(t0, now_dt=t_48h)
    assert pts == 15

    # 49 hours total -> 15 pts
    t_49h = t0 + timedelta(hours=49)
    pts, overdue, hrs = calculate_delay_points(t0, now_dt=t_49h)
    assert pts == 15

    # 72 hours total (48 complete hours overdue) -> 10 + 5*2 = 20 pts
    t_72h = t0 + timedelta(hours=72)
    pts, overdue, hrs = calculate_delay_points(t0, now_dt=t_72h)
    assert pts == 20

    # 96 hours total (72 complete hours overdue) -> 10 + 5*3 = 25 pts
    t_96h = t0 + timedelta(hours=96)
    pts, overdue, hrs = calculate_delay_points(t0, now_dt=t_96h)
    assert pts == 25

    # 120 hours total (96 complete hours overdue) -> 30 pts (cap)
    t_120h = t0 + timedelta(hours=120)
    pts, overdue, hrs = calculate_delay_points(t0, now_dt=t_120h)
    assert pts == 30

    # 200 hours total -> capped at 30 pts
    t_200h = t0 + timedelta(hours=200)
    pts, overdue, hrs = calculate_delay_points(t0, now_dt=t_200h)
    assert pts == 30

def test_manager_response_freezes_delay():
    t0 = datetime(2026, 10, 20, 12, 0, 0, tzinfo=timezone.utc)
    # Manager responds at 22 hours (before deadline)
    t_resp_early = t0 + timedelta(hours=22)
    # Now is 10 days later
    t_now = t0 + timedelta(days=10)
    pts, overdue, hrs = calculate_delay_points(t0, responded_at=t_resp_early, now_dt=t_now)
    assert pts == 0
    assert not overdue

    # Manager responds at 49 hours (25h overdue -> penalty was 15 at response time)
    t_resp_late = t0 + timedelta(hours=49)
    pts, overdue, hrs = calculate_delay_points(t0, responded_at=t_resp_late, now_dt=t_now)
    assert pts == 15
    assert overdue

def test_score_range_and_resolution_credits():
    # Normal score
    res = calculate_risk_score(recurrence_points=30, delay_points=15, resolution_credits=15)
    assert res["score"] == 30
    assert res["raw_score"] == 45
    assert res["level"] == "MEDIUM"

    # Score bounded at 0
    res_zero = calculate_risk_score(recurrence_points=0, delay_points=0, resolution_credits=30)
    assert res_zero["score"] == 0

    # Score capped at 100
    res_cap = calculate_risk_score(recurrence_points=45, delay_points=30, resolution_credits=0)
    assert res_cap["score"] == 75

def test_risk_levels():
    assert determine_risk_level(0) == "LOW"
    assert determine_risk_level(29) == "LOW"
    assert determine_risk_level(30) == "MEDIUM"
    assert determine_risk_level(59) == "MEDIUM"
    assert determine_risk_level(60) == "HIGH"
    assert determine_risk_level(79) == "HIGH"
    assert determine_risk_level(80) == "CRITICAL"
    assert determine_risk_level(100) == "CRITICAL"

def test_escalation_rules():
    # 59 points -> No ordinary escalation
    esc, reason = should_escalate(59, is_safety_hazard=False)
    assert not esc
    assert reason is None

    # 60 points -> Escalation
    esc, reason = should_escalate(60, is_safety_hazard=False)
    assert esc
    assert reason == "threshold_reached"

    # 85 points -> Escalation
    esc, reason = should_escalate(85, is_safety_hazard=False)
    assert esc
    assert reason == "threshold_reached"

    # Urgent food safety hazard below 60 -> Immediate escalation!
    esc, reason = should_escalate(15, is_safety_hazard=True)
    assert esc
    assert reason == "urgent_food_safety"

if __name__ == "__main__":
    test_recurrence_points()
    test_weekly_deduplication()
    test_delay_points_within_deadline()
    test_delay_points_after_deadline()
    test_manager_response_freezes_delay()
    test_score_range_and_resolution_credits()
    test_risk_levels()
    test_escalation_rules()
    print("ALL RISK ENGINE FORMULA TESTS PASSED!")
