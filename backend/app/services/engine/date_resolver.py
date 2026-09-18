from datetime import date, datetime
from zoneinfo import ZoneInfo

from dateutil.relativedelta import relativedelta

from ...models.compilation import Anchor, NoticeCompilation
from ...models.rule import RelativeDate


def anchor_date(anchor: Anchor, timezone: str) -> date:
    if anchor.type == "DATE":
        return date.fromisoformat(anchor.value)
    return datetime.fromisoformat(anchor.value).astimezone(ZoneInfo(timezone)).date()


def add_calendar_offset(value: date, months: int = 0, days: int = 0) -> date:
    return value + relativedelta(months=months, days=days)


def resolve_dates(value: RelativeDate, compilation: NoticeCompilation) -> list[tuple[str, date]]:
    base = value.base
    ids = [base.anchorId] if base.kind == "anchor_reference" else base.candidateAnchorIds
    anchors = {a.id: a for a in compilation.anchors}
    return [(id_, add_calendar_offset(anchor_date(anchors[id_], compilation.timezone),
                                     value.offset.months, value.offset.days)) for id_ in ids]
