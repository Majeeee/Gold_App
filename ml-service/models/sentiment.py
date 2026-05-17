"""
Gold news sentiment analysis using TextBlob + RSS feeds.
Falls back gracefully when feeds are unreachable.
"""
import feedparser
from textblob import TextBlob

NEWS_FEEDS = [
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC%3DF&region=US&lang=en-US",
    "https://rss.app/feeds/gold-market-news.xml",
]

GOLD_KEYWORDS = ["gold", "xau", "bullion", "precious metal", "طلا", "فدرال", "دلار"]


def _is_relevant(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in GOLD_KEYWORDS)


def get_gold_sentiment() -> dict:
    articles = []
    for url in NEWS_FEEDS:
        try:
            feed = feedparser.parse(url, request_headers={"User-Agent": "GoldApp/3.0"})
            for entry in feed.entries[:15]:
                title   = entry.get("title", "")
                summary = entry.get("summary", "")
                text    = f"{title} {summary}"
                if not _is_relevant(text):
                    continue
                blob = TextBlob(text)
                articles.append({
                    "title":        title[:120],
                    "sentiment":    round(blob.sentiment.polarity, 3),
                    "subjectivity": round(blob.sentiment.subjectivity, 3),
                    "source":       entry.get("link", ""),
                })
        except Exception:
            pass

    if not articles:
        return {
            "status":           "no_data",
            "overall_sentiment": 0.0,
            "sentiment_label":   "NEUTRAL",
            "article_count":    0,
            "articles":         [],
            "interpretation":   "No news fetched — sentiment unavailable",
        }

    scores  = [a["sentiment"] for a in articles]
    overall = sum(scores) / len(scores)

    if overall > 0.15:
        label = "BULLISH"
        interp = "Positive news sentiment supports higher gold prices"
    elif overall < -0.15:
        label = "BEARISH"
        interp = "Negative news sentiment may pressure gold prices"
    else:
        label = "NEUTRAL"
        interp = "Mixed or neutral news sentiment"

    return {
        "status":            "ok",
        "overall_sentiment":  round(overall, 3),
        "sentiment_label":    label,
        "article_count":     len(articles),
        "articles":          articles[:5],
        "interpretation":    interp,
        "bullish_count":     sum(1 for s in scores if s > 0.1),
        "bearish_count":     sum(1 for s in scores if s < -0.1),
        "neutral_count":     sum(1 for s in scores if -0.1 <= s <= 0.1),
    }


def analyze_text(text: str) -> dict:
    blob = TextBlob(text)
    pol = blob.sentiment.polarity
    return {
        "polarity":     round(pol, 3),
        "subjectivity": round(blob.sentiment.subjectivity, 3),
        "label":        "BULLISH" if pol > 0.1 else "BEARISH" if pol < -0.1 else "NEUTRAL",
    }
