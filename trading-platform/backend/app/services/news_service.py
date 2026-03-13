"""
News & Sentiment Service
Fetches global financial news from multiple sources and analyzes sentiment
"""
import asyncio
import aiohttp
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from cachetools import TTLCache
import logging
import re

from app.config import settings
from app.ai.sentiment_analyzer import get_sentiment_analyzer

logger = logging.getLogger(__name__)

_news_cache = TTLCache(maxsize=100, ttl=300)  # 5-min cache


SYMBOL_KEYWORDS = {
    "AAPL": ["Apple", "iPhone", "Tim Cook", "iOS", "Mac", "App Store"],
    "MSFT": ["Microsoft", "Azure", "Satya Nadella", "Windows", "Office 365"],
    "GOOGL": ["Google", "Alphabet", "Android", "YouTube", "DeepMind"],
    "AMZN": ["Amazon", "AWS", "Prime", "Bezos"],
    "NVDA": ["Nvidia", "CUDA", "GPU", "Jensen Huang", "GeForce"],
    "TSLA": ["Tesla", "Elon Musk", "Electric vehicle", "EV", "Autopilot"],
    "META": ["Meta", "Facebook", "Instagram", "WhatsApp", "Zuckerberg"],
    "BTC-USD": ["Bitcoin", "BTC", "cryptocurrency", "crypto", "blockchain", "Satoshi"],
    "ETH-USD": ["Ethereum", "ETH", "smart contract", "DeFi", "Vitalik"],
    "RELIANCE.NS": ["Reliance", "Mukesh Ambani", "Jio", "RIL"],
    "TCS.NS": ["TCS", "Tata Consultancy", "IT services"],
    "HDFCBANK.NS": ["HDFC Bank", "HDFC", "banking India"],
    "INFY.NS": ["Infosys", "Narayana Murthy", "IT India"],
}

GENERAL_FINANCE_QUERIES = [
    "stock market today",
    "US stock market",
    "India NSE BSE",
    "cryptocurrency market",
    "Federal Reserve interest rates",
    "RBI India monetary policy",
    "global market outlook",
    "earnings report",
    "economic data",
]


async def _fetch_newsapi(query: str, api_key: str, page_size: int = 10) -> List[Dict]:
    """Fetch from NewsAPI.org"""
    if not api_key:
        return []

    url = "https://newsapi.org/v2/everything"
    params = {
        "q": query,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": page_size,
        "apiKey": api_key,
        "from": (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d"),
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("articles", [])
    except Exception as e:
        logger.warning(f"NewsAPI error for '{query}': {e}")
    return []


async def _fetch_rss_headlines(url: str) -> List[Dict]:
    """Fetch headlines from RSS feed"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                if resp.status == 200:
                    text = await resp.text()
                    return _parse_rss(text)
    except Exception as e:
        logger.warning(f"RSS fetch error for {url}: {e}")
    return []


def _parse_rss(xml_text: str) -> List[Dict]:
    """Simple RSS parser"""
    items = []
    item_pattern = re.compile(r'<item>(.*?)</item>', re.DOTALL)
    title_pattern = re.compile(r'<title><!\[CDATA\[(.*?)\]\]></title>|<title>(.*?)</title>', re.DOTALL)
    desc_pattern = re.compile(r'<description><!\[CDATA\[(.*?)\]\]></description>|<description>(.*?)</description>', re.DOTALL)
    link_pattern = re.compile(r'<link>(.*?)</link>', re.DOTALL)
    date_pattern = re.compile(r'<pubDate>(.*?)</pubDate>', re.DOTALL)

    for match in item_pattern.finditer(xml_text):
        item_text = match.group(1)
        title_m = title_pattern.search(item_text)
        desc_m = desc_pattern.search(item_text)
        link_m = link_pattern.search(item_text)
        date_m = date_pattern.search(item_text)

        title = (title_m.group(1) or title_m.group(2) or "").strip() if title_m else ""
        desc = (desc_m.group(1) or desc_m.group(2) or "").strip() if desc_m else ""
        url = link_m.group(1).strip() if link_m else ""
        pub_date = date_m.group(1).strip() if date_m else ""

        # Clean HTML
        desc = re.sub(r'<[^>]+>', '', desc)[:500]

        if title:
            items.append({
                "title": title,
                "description": desc,
                "url": url,
                "publishedAt": pub_date,
                "source": {"name": "RSS"},
            })

    return items[:15]


RSS_FEEDS = [
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s=aapl,msft,nvda,tsla&region=US&lang=en-US",
    "https://www.moneycontrol.com/rss/MCtopnews.xml",
    "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
]


async def fetch_global_news(limit: int = 50) -> List[Dict]:
    """Fetch global financial news from all available sources"""
    cache_key = "global_news"
    if cache_key in _news_cache:
        return _news_cache[cache_key]

    all_articles = []

    # 1. NewsAPI
    if settings.NEWS_API_KEY:
        tasks = [
            _fetch_newsapi(q, settings.NEWS_API_KEY, page_size=5)
            for q in GENERAL_FINANCE_QUERIES[:4]
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, list):
                all_articles.extend(r)

    # 2. RSS feeds
    rss_tasks = [_fetch_rss_headlines(url) for url in RSS_FEEDS]
    rss_results = await asyncio.gather(*rss_tasks, return_exceptions=True)
    for r in rss_results:
        if isinstance(r, list):
            all_articles.extend(r)

    # Deduplicate by title
    seen = set()
    unique = []
    for article in all_articles:
        title = article.get("title", "").strip()
        if title and title not in seen:
            seen.add(title)
            unique.append(article)

    # Analyze sentiment
    analyzer = get_sentiment_analyzer()
    enriched = []
    for article in unique[:limit]:
        text = f"{article.get('title','')} {article.get('description','')}"
        result = analyzer.analyze_text(text)
        enriched.append({
            **article,
            "sentiment_score": result.score,
            "sentiment_label": result.label,
            "sentiment_confidence": result.confidence,
        })

    # Sort by relevance (absolute sentiment strength)
    enriched.sort(key=lambda x: abs(x.get("sentiment_score", 0)), reverse=True)

    _news_cache[cache_key] = enriched
    return enriched


async def fetch_symbol_news(symbol: str, limit: int = 10) -> List[Dict]:
    """Fetch news specific to a symbol"""
    cache_key = f"news_{symbol}"
    if cache_key in _news_cache:
        return _news_cache[cache_key]

    keywords = SYMBOL_KEYWORDS.get(symbol, [symbol.replace(".NS", "").replace("-USD", "")])
    query = " OR ".join(keywords[:3])

    articles = []

    if settings.NEWS_API_KEY:
        articles = await _fetch_newsapi(query, settings.NEWS_API_KEY, page_size=limit)

    if not articles:
        # Fallback: filter global news
        global_news = await fetch_global_news()
        kw_lower = [k.lower() for k in keywords]
        articles = [
            a for a in global_news
            if any(kw in (a.get("title", "") + a.get("description", "")).lower() for kw in kw_lower)
        ][:limit]

    analyzer = get_sentiment_analyzer()
    enriched = []
    for article in articles:
        text = f"{article.get('title','')} {article.get('description','')}"
        result = analyzer.analyze_text(text)
        enriched.append({
            **article,
            "sentiment_score": result.score,
            "sentiment_label": result.label,
            "sentiment_confidence": result.confidence,
        })

    _news_cache[cache_key] = enriched
    return enriched


async def get_market_sentiment_summary() -> Dict:
    """Get overall market sentiment from news"""
    news = await fetch_global_news(limit=30)

    analyzer = get_sentiment_analyzer()
    result = analyzer.analyze_news_articles(news)

    return {
        **result,
        "total_articles": len(news),
        "timestamp": datetime.utcnow().isoformat(),
        "top_headlines": [
            {
                "title": a.get("title", ""),
                "sentiment": a.get("sentiment_label", "NEUTRAL"),
                "score": a.get("sentiment_score", 0),
                "source": a.get("source", {}).get("name", "Unknown"),
            }
            for a in news[:5]
        ],
    }
