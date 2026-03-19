"""
Options Pricing Service — Black-Scholes with Greeks

Provides accurate options pricing, Greeks, and IV estimation
without external dependencies (scipy replaced with erf-based N(x)).
"""
import math
import logging
from datetime import date, timedelta, datetime
from typing import Literal

logger = logging.getLogger(__name__)

# ── Standard normal CDF via error function (no scipy needed) ──────────────────
def _ncdf(x: float) -> float:
    """Standard normal cumulative distribution function."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _npdf(x: float) -> float:
    """Standard normal probability density function."""
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


# ── Implied volatility table by sector/market ─────────────────────────────────
# Realistic IV ranges for different asset classes
_IV_BY_MARKET = {
    "US_MEGA_TECH": 0.38,   # NVDA, AAPL, MSFT, META
    "US_GROWTH":    0.45,   # TSLA, PLTR, RIVN
    "US_MEME":      0.80,   # GME, AMC
    "US_BLUE_CHIP": 0.22,   # JNJ, KO, PG
    "US_FINANCE":   0.28,   # JPM, BAC, GS
    "US_DEFAULT":   0.32,
    "CRYPTO":       0.90,
    "INDIA":        0.35,
}

HIGH_IV_SYMBOLS = {"TSLA", "NVDA", "GME", "AMC", "RIVN", "COIN", "HOOD", "SOFI", "PLTR", "META"}
MEGA_TECH = {"AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "AVGO"}
BLUE_CHIP = {"JNJ", "KO", "PG", "WMT", "MCD", "PM", "MMM", "CAT"}
FINANCE   = {"JPM", "BAC", "WFC", "GS", "MS", "V", "MA", "AXP"}


def _get_iv(symbol: str, market: str = "US") -> float:
    """Return realistic implied volatility for a symbol."""
    if market == "CRYPTO":
        return _IV_BY_MARKET["CRYPTO"]
    if market == "INDIA":
        return _IV_BY_MARKET["INDIA"]
    sym = symbol.upper()
    if sym in HIGH_IV_SYMBOLS:
        return _IV_BY_MARKET["US_GROWTH"]
    if sym in MEGA_TECH:
        return _IV_BY_MARKET["US_MEGA_TECH"]
    if sym in BLUE_CHIP:
        return _IV_BY_MARKET["US_BLUE_CHIP"]
    if sym in FINANCE:
        return _IV_BY_MARKET["US_FINANCE"]
    return _IV_BY_MARKET["US_DEFAULT"]


# ── Black-Scholes core ────────────────────────────────────────────────────────
def black_scholes(
    S: float,          # current stock price
    K: float,          # strike price
    T: float,          # time to expiry in years (e.g. 30/365)
    r: float = 0.053,  # risk-free rate (Fed funds ~5.3%)
    sigma: float = 0.30,
    option_type: Literal["call", "put"] = "call",
) -> float:
    """Black-Scholes option price. Returns per-share premium."""
    if T <= 0:
        return max(0.0, S - K) if option_type == "call" else max(0.0, K - S)
    if S <= 0 or K <= 0 or sigma <= 0:
        return 0.0

    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)

    if option_type == "call":
        price = S * _ncdf(d1) - K * math.exp(-r * T) * _ncdf(d2)
    else:
        price = K * math.exp(-r * T) * _ncdf(-d2) - S * _ncdf(-d1)

    return max(0.0, round(price, 4))


def greeks(
    S: float,
    K: float,
    T: float,
    r: float = 0.053,
    sigma: float = 0.30,
    option_type: Literal["call", "put"] = "call",
) -> dict:
    """Compute Delta, Gamma, Theta, Vega for an option."""
    if T <= 0:
        return {"delta": 1.0 if option_type == "call" else -1.0,
                "gamma": 0.0, "theta": 0.0, "vega": 0.0}

    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)

    pdf_d1 = _npdf(d1)
    gamma  = pdf_d1 / (S * sigma * math.sqrt(T))
    vega   = S * pdf_d1 * math.sqrt(T) * 0.01   # per 1% IV move

    if option_type == "call":
        delta = _ncdf(d1)
        theta = (
            -S * pdf_d1 * sigma / (2 * math.sqrt(T))
            - r * K * math.exp(-r * T) * _ncdf(d2)
        ) / 365
    else:
        delta = _ncdf(d1) - 1.0
        theta = (
            -S * pdf_d1 * sigma / (2 * math.sqrt(T))
            + r * K * math.exp(-r * T) * _ncdf(-d2)
        ) / 365

    return {
        "delta": round(delta, 4),
        "gamma": round(gamma, 6),
        "theta": round(theta, 4),   # daily decay in $
        "vega":  round(vega,  4),   # $ gain per 1% IV increase
    }


# ── Options signal builder ────────────────────────────────────────────────────
def build_options_signal(
    symbol: str,
    market: str,
    stock_action: str,    # BUY | SELL
    stock_price: float,
    confidence: float,
    expected_return_pct: float,
    hold_days: int,
    entry_date: str,
    exit_date: str,
    reasoning: str = "",
) -> dict | None:
    """
    Build a full options recommendation from a stock signal.

    - BUY  → Long CALL (ATM or slight OTM)
    - SELL → Long PUT  (ATM or slight OTM)

    Returns a dict with pricing, Greeks, P&L estimates, and mirror instructions.
    """
    if stock_action not in ("BUY", "SELL") or stock_price <= 0:
        return None

    is_call  = stock_action == "BUY"
    opt_type = "CALL" if is_call else "PUT"

    iv    = _get_iv(symbol, market)
    r     = 0.053
    # Expiry: align with hold_days, snap to standard weekly/monthly
    expiry_days = max(7, hold_days + 5)    # give a few extra days beyond hold
    if expiry_days <= 14:
        expiry_days = 14    # bi-weekly
    elif expiry_days <= 30:
        expiry_days = 30    # monthly
    else:
        expiry_days = 60    # 2-month

    T = expiry_days / 365.0

    # Strike selection: slightly OTM for leverage
    otm_factor = 1.015 if is_call else 0.985
    strike = round(stock_price * otm_factor, 2)

    # Snap strike to nearest $0.50 (like real options chains)
    strike = round(strike / 0.5) * 0.5

    # Price the option
    entry_premium = black_scholes(stock_price, strike, T, r, iv,
                                  "call" if is_call else "put")
    if entry_premium < 0.01:
        entry_premium = max(0.01, stock_price * 0.01)   # min 1% floor

    # Estimate target premium based on stock target
    target_price_stock = stock_price * (1 + expected_return_pct / 100)
    t_remaining = max(1, expiry_days - hold_days) / 365.0
    target_premium = black_scholes(target_price_stock, strike, t_remaining, r, iv,
                                   "call" if is_call else "put")
    target_premium = max(entry_premium * 0.5, target_premium)   # at least 50% of entry

    # Greeks at entry
    g = greeks(stock_price, strike, T, r, iv, "call" if is_call else "put")

    # P&L metrics (per 1 contract = 100 shares)
    contracts      = max(1, int(500 / (entry_premium * 100)))   # $500 notional
    notional       = contracts * entry_premium * 100
    max_loss       = round(notional, 2)
    max_gain_stock = target_premium * contracts * 100
    exp_gain_pct   = round((target_premium - entry_premium) / entry_premium * 100, 1)
    margin_of_safety = round((stock_price - strike) / strike * 100, 2) if is_call else \
                       round((strike - stock_price) / strike * 100, 2)

    expiry_date = (date.fromisoformat(entry_date) + timedelta(days=expiry_days)).isoformat()

    return {
        "symbol":            symbol,
        "market":            market,
        "underlying_action": stock_action,
        "option_type":       opt_type,
        "strategy":          f"Long {opt_type}",
        "strike":            strike,
        "expiry_days":       expiry_days,
        "expiry_date":       expiry_date,
        "entry_premium":     round(entry_premium, 3),
        "target_premium":    round(target_premium, 3),
        "underlying_price":  stock_price,
        "underlying_target": round(target_price_stock, 2),
        "iv":                round(iv * 100, 1),        # e.g. 32.0 → "32.0%"
        "confidence":        confidence,
        "expected_option_return_pct": exp_gain_pct,
        "max_loss_per_contract": round(entry_premium * 100, 2),
        "max_gain_estimate":     round(max_gain_stock, 2),
        "margin_of_safety_pct": margin_of_safety,
        "contracts_for_500":    contracts,
        "notional":              round(notional, 2),
        "delta":  g["delta"],
        "gamma":  g["gamma"],
        "theta":  g["theta"],
        "vega":   g["vega"],
        "entry_date":  entry_date,
        "exit_date":   exit_date,
        "expiry_date": expiry_date,
        "reasoning":   reasoning or f"{stock_action} signal → Long {opt_type} @ ${strike}",
        "mirror_instruction": (
            f"Buy {contracts} {symbol} {expiry_date} ${strike} {opt_type} "
            f"@ ~${entry_premium:.2f} | Target: ${target_premium:.2f} | "
            f"Max loss: ${max_loss:.0f}"
        ),
    }


def reprice_option(
    symbol: str,
    market: str,
    option_type: str,   # "CALL" | "PUT"
    strike: float,
    current_stock_price: float,
    days_remaining: int,
    r: float = 0.053,
) -> float:
    """Reprice an open options position at current stock price and time."""
    iv = _get_iv(symbol, market)
    T  = max(0, days_remaining) / 365.0
    return black_scholes(
        current_stock_price, strike, T, r, iv,
        "call" if option_type == "CALL" else "put"
    )
