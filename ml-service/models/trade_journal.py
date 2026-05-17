from dataclasses import dataclass, field, asdict
from typing import Optional
from datetime import datetime
import json, os, hashlib

JOURNAL_FILE = "data/trade_journal.json"

@dataclass
class JournalEntry:
    trade_id:        str
    market:          str          # GLOBAL | IRAN
    trade_type:      str          # BUY | SELL
    entry_reason:    str
    signal_score:    int
    indicators:      dict         # snapshot of all indicator votes at entry
    timeframe:       str
    entry_price:     float
    exit_price:      Optional[float] = None
    pnl:             Optional[float] = None
    outcome:         Optional[str]  = None   # WIN | LOSS | BREAK_EVEN
    lesson:          Optional[str]  = None
    timestamp:       str = field(default_factory=lambda: datetime.utcnow().isoformat())
    id:              str = field(default_factory=lambda: hashlib.md5(
                         (datetime.utcnow().isoformat()).encode()).hexdigest()[:8])


class TradeJournal:
    def __init__(self):
        os.makedirs("data", exist_ok=True)
        self._entries: list[dict] = self._load()

    def _load(self) -> list:
        if os.path.exists(JOURNAL_FILE):
            with open(JOURNAL_FILE) as f:
                return json.load(f)
        return []

    def _save(self):
        with open(JOURNAL_FILE, "w") as f:
            json.dump(self._entries, f, indent=2)

    def add_entry(self, entry: JournalEntry) -> dict:
        d = asdict(entry)
        self._entries.append(d)
        self._save()
        return d

    def update_outcome(self, trade_id: str, exit_price: float,
                       pnl: float, lesson: str = "") -> dict:
        for e in self._entries:
            if e["trade_id"] == trade_id:
                e["exit_price"] = exit_price
                e["pnl"]        = pnl
                e["outcome"]    = "WIN" if pnl > 0 else ("LOSS" if pnl < 0 else "BREAK_EVEN")
                e["lesson"]     = lesson
                self._save()
                return e
        raise ValueError(f"trade_id {trade_id} not found")

    def get_all(self) -> list:
        return self._entries

    def analyze(self) -> dict:
        entries = self._entries
        if not entries:
            return {"total": 0}

        closed  = [e for e in entries if e.get("outcome")]
        wins    = [e for e in closed if e["outcome"] == "WIN"]
        losses  = [e for e in closed if e["outcome"] == "LOSS"]
        total_pnl = sum(e.get("pnl", 0) for e in closed)

        # win rate by signal score bucket
        score_buckets: dict[str, list] = {}
        for e in closed:
            bucket = f"score_{e['signal_score']}"
            score_buckets.setdefault(bucket, []).append(e["outcome"] == "WIN")

        score_win_rates = {
            k: round(sum(v) / len(v) * 100, 1)
            for k, v in score_buckets.items()
        }

        # common lessons
        lessons = [e["lesson"] for e in closed if e.get("lesson")]

        return {
            "total":        len(entries),
            "closed":       len(closed),
            "wins":         len(wins),
            "losses":       len(losses),
            "win_rate_pct": round(len(wins) / len(closed) * 100, 1) if closed else 0,
            "total_pnl":    round(total_pnl, 2),
            "avg_win":      round(sum(e["pnl"] for e in wins) / len(wins), 2) if wins else 0,
            "avg_loss":     round(sum(e["pnl"] for e in losses) / len(losses), 2) if losses else 0,
            "score_win_rates": score_win_rates,
            "recent_lessons":  lessons[-5:],
        }


journal = TradeJournal()
