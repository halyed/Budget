import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a concise personal finance advisor. "
    "Analyze the budget data and provide exactly 4-5 bullet points with actionable insights. "
    "Focus on trends, unusual spending, and one concrete saving tip. "
    "Be direct. Use plain text only, no markdown headers."
)


def _format_context(report_data: dict) -> str:
    lines = ["Budget data summary:"]
    for m in report_data.get("months", []):
        lines.append(
            f"- {m['label']}: income={m['income']}€, expenses={m['expenses']}€, "
            f"saved={m['savings']}€, savings_rate={m['savings_rate']}%"
        )
    trends = report_data.get("category_trends", [])
    if trends:
        lines.append("\nTop expense categories (latest month):")
        sorted_cats = sorted(trends, key=lambda c: c["amounts"][-1] if c["amounts"] else 0, reverse=True)
        for cat in sorted_cats[:5]:
            latest = cat["amounts"][-1] if cat["amounts"] else 0
            lines.append(f"- {cat['category_name']}: {latest}€")
    return "\n".join(lines)


def get_insights(report_data: dict) -> str:
    context = _format_context(report_data)
    prompt = f"{context}\n\nProvide 4-5 bullet point insights:"

    try:
        resp = httpx.post(
            f"{settings.ollama_url}/api/generate",
            json={
                "model": settings.ollama_model,
                "prompt": f"<|system|>\n{SYSTEM_PROMPT}<|end|>\n<|user|>\n{prompt}<|end|>\n<|assistant|>",
                "stream": False,
                "options": {"temperature": 0.3, "num_predict": 400},
            },
            timeout=120.0,
        )
        resp.raise_for_status()
        return resp.json().get("response", "").strip()
    except httpx.ConnectError:
        logger.error("Ollama not reachable at %s", settings.ollama_url)
        raise RuntimeError("AI service is not available. Make sure Ollama is running.")
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise RuntimeError(
                f"Model '{settings.ollama_model}' not found. "
                f"Run: docker exec budget-ollama ollama pull {settings.ollama_model}"
            )
        raise RuntimeError(f"Ollama error: {e.response.text}")
