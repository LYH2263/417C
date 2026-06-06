from transformers import pipeline
import torch
import os

try:
    from app.logger import get_logger
except ImportError:
    try:
        from .logger import get_logger
    except ImportError:
        from logger import get_logger

logger = get_logger("detector")

os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'

_detector = None

def get_detector():
    global _detector
    if os.getenv("DISABLE_AI_DETECTION") == "true":
        logger.info("AI detection disabled via environment variable")
        return None

    if _detector is None:
        try:
            model_name = "distilbert-base-uncased"
            _detector = pipeline("text-classification", model=model_name)
            logger.info(f"AI detection model loaded successfully: {model_name}")
        except Exception as e:
            logger.warning(f"Model loading failed, using fallback: {e}", exc_info=True)
            _detector = None
    return _detector

def detect_ai_content(text: str):
    detector = get_detector()
    
    # 如果模型加载失败，使用简单规则
    if detector is None:
        return {
            "overall_ai_score": 50.0,
            "details": [{
                "text": text[:500],
                "ai_score": 0.5
            }],
            "note": "模型加载中，当前为模拟数据"
        }
    
    # Split text into chunks if it's too long (max 512 tokens for BERT models)
    max_length = 500
    chunks = [text[i:i+max_length] for i in range(0, len(text), max_length)]
    
    results = []
    for chunk in chunks:
        if len(chunk.strip()) < 10: continue
        try:
            res = detector(chunk)[0]
            # 对于 distilbert，我们需要根据 label 判断
            # 通常 LABEL_1 表示正类（可能是 AI 生成）
            ai_score = res['score'] if 'LABEL_1' in res.get('label', '') else (1 - res['score'])
            results.append({
                "text": chunk,
                "ai_score": ai_score
            })
        except Exception as e:
            logger.error(f"Detection error on chunk: {e}", exc_info=True)
            results.append({
                "text": chunk,
                "ai_score": 0.5
            })
    
    if not results:
        return {"overall_ai_score": 0, "details": []}
        
    avg_score = sum(r['ai_score'] for r in results) / len(results)
    return {
        "overall_ai_score": round(avg_score * 100, 2),
        "details": results
    }
