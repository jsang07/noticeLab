from datetime import date

from app.models.compilation import Anchor
from app.services.engine.date_resolver import add_calendar_offset, anchor_date


def test_calendar_months_not_90_days():
    assert add_calendar_offset(date(2026, 4, 10), 3) == date(2026, 7, 10)


def test_month_end_clamping():
    assert add_calendar_offset(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert add_calendar_offset(date(2024, 1, 31), 1) == date(2024, 2, 29)


def test_anchor_timezone_conversion():
    assert anchor_date(Anchor(id="a", type="DATETIME", value="2026-04-09T23:00:00Z"), "Asia/Seoul") == date(2026, 4, 10)
