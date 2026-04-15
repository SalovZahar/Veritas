"""
Veritas FastAPI server.
Connects the browser extension to the ML pipeline.

    uvicorn server:app --host 0.0.0.0 --port 8000 --reload
    python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

from ml.inference import classify_text
from ml.sources import find_sources
from ml.deep_analysis import deep_analyse

app = FastAPI(
    title="Veritas API",
    description="Fake news detection API for the Veritas browser extension",
    version="1.0.0",
)

# Allow requests from Chrome extension (chrome-extension://* origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)

class TextRequest(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v or len(v.strip()) < 10:
            raise ValueError("Text must be at least 10 characters long.")
        return v.strip()


class DeepAnalysisRequest(BaseModel):
    text: str
    model_result: dict
    sources_result: dict

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v or len(v.strip()) < 10:
            raise ValueError("Text must be at least 10 characters long.")
        return v.strip()


# Endpoints

@app.get("/health")
def health():
    """Quick health check — use this to verify the server is running."""
    return {"status": "ok", "service": "Veritas API"}


@app.post("/classify")
def classify(req: TextRequest):
    """
    Classify text as fake or real using the fine-tuned RoBERTa model.

    Returns:
        label:      "fake" | "real"
        confidence: float 0.0–1.0
        score:      int 0–100  (0 = fake, 100 = real)
        probs:      { fake: float, real: float }
    """
    try:
        result = classify_text(req.text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model error: {str(e)}")

    return result


@app.post("/sources")
def sources(req: TextRequest):
    """
    Search for related sources via DuckDuckGo and match against trusted list.

    Returns:
        query:         search query used
        sources:       list of { title, url, domain, snippet, trusted, trusted_name }
        trusted_count: number of sources from the trusted list
        error:         None or error message string
    """
    result = find_sources(req.text)  # never raises — always returns dict
    return result


@app.post("/deep-analyse")
def deep_analysis(req: DeepAnalysisRequest):
    """
    Deep analysis via LLM (OpenRouter).
    Requires model_result from /classify and sources_result from /sources.

    Returns:
        verdict:        fake | likely_fake | mixed | likely_real | real
        confidence:     int 0–100
        explanation:    short explanation string
        signals:        { factual_issues, manipulation_signs, source_analysis, contradictions }
        final_reasoning: detailed analysis string
        error:          None or error message string
    """
    result = deep_analyse(
        news_text=req.text,
        model_result=req.model_result,
        sources_result=req.sources_result,
    )

    if result.get("error"):
        # LLM errors are soft — return 503 so the extension can handle gracefully
        raise HTTPException(status_code=503, detail=result["error"])

    return result
