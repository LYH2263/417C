import os
import requests
from dotenv import load_dotenv

try:
    from app.dictionary_loader import DictionaryLoader, Dictionary
    from app.matcher import AhoCorasickMatcher, TrieMatcher
    from app.case_preserver import CasePreserver
    from app.transform_rules import TransformEngine
    from app.logger import get_logger
except ImportError:
    try:
        from .dictionary_loader import DictionaryLoader, Dictionary
        from .matcher import AhoCorasickMatcher, TrieMatcher
        from .case_preserver import CasePreserver
        from .transform_rules import TransformEngine
        from .logger import get_logger
    except ImportError:
        from dictionary_loader import DictionaryLoader, Dictionary
        from matcher import AhoCorasickMatcher, TrieMatcher
        from case_preserver import CasePreserver
        from transform_rules import TransformEngine
        from logger import get_logger

load_dotenv()

logger = get_logger("rewriter")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "llama-3.3-70b-versatile")


class LexicalRewriter:
    def __init__(
        self,
        dict_loader: DictionaryLoader = None,
        matcher_cls=AhoCorasickMatcher,
        case_preserver: CasePreserver = None,
    ):
        self.dict_loader = dict_loader or DictionaryLoader()
        self.matcher_cls = matcher_cls
        self.case_preserver = case_preserver or CasePreserver()
        self._matcher_cache = {}

    def _get_matcher(self, dictionary: Dictionary):
        cache_key = dictionary.name
        if cache_key in self._matcher_cache:
            return self._matcher_cache[cache_key]
        patterns = dictionary.all_patterns()
        matcher = self.matcher_cls(patterns)
        self._matcher_cache[cache_key] = matcher
        return matcher

    def rewrite(self, text: str, domain: str = None) -> str:
        dictionary = self.dict_loader.load_for_text(text, explicit=domain)
        matcher = self._get_matcher(dictionary)
        matches = matcher.search(text)
        matches.sort(key=lambda m: m[0], reverse=True)
        result = text
        for start, end, pattern, replacement in matches:
            ok, new_text = self.case_preserver.match_and_replace(
                result, start, end, pattern, replacement
            )
            if ok:
                result = new_text
        return result


class SentenceRewriter:
    def __init__(self, engine: TransformEngine = None, seed: int = 42):
        self.engine = engine or TransformEngine(seed=seed)

    def rewrite(self, text: str, rule_names=None) -> str:
        if rule_names:
            return self.engine.apply_subset(text, rule_names)
        return self.engine.apply_all(text)


class SimulatedRewriter:
    def __init__(
        self,
        lexical: LexicalRewriter = None,
        sentence: SentenceRewriter = None,
        seed: int = 42,
    ):
        self.lexical = lexical or LexicalRewriter()
        self.sentence = sentence or SentenceRewriter(seed=seed)

    def rewrite(self, text: str, domain: str = None, enable_sentence: bool = True) -> str:
        result = self.lexical.rewrite(text, domain=domain)
        if enable_sentence:
            result = self.sentence.rewrite(result)
        return result


_default_rewriter = None


def _get_default_rewriter() -> SimulatedRewriter:
    global _default_rewriter
    if _default_rewriter is None:
        _default_rewriter = SimulatedRewriter()
    return _default_rewriter


def _simulated_rewrite(text: str) -> str:
    return _get_default_rewriter().rewrite(text)


def rewrite_text(text: str, level: str = "medium"):
    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not configured, using fallback (simulated rewrite)")
        return _simulated_rewrite(text)

    prompts = {
        "low": "Perform slight synonym replacement and minor sentence restructuring to improve flow while maintaining the original tone.",
        "medium": "Restructure sentences and vary vocabulary significantly. Use diverse sentence lengths and improve transitional flow to sound more like a seasoned human academic writer.",
        "high": "Deeply transform the narrative structure. Combine or split sentences, use sophisticated academic vocabulary, and introduce human-like 'burstiness' (varying complexity). Ensure the meaning is identical but the linguistic fingerprint is entirely different."
    }

    instruction = prompts.get(level, prompts["medium"])

    system_prompt = f"""You are a professional academic editor specialized in reducing AIGC (AI-Generated Content) detection rates while maintaining extreme academic rigors.

    Your Task: {instruction}

    STRICT CONSTRAINTS:
    1. DO NOT change any technical terms, domain-specific vocabulary, or proper nouns.
    2. DO NOT change any mathematical formulas, LaTeX expressions, or chemical symbols.
    3. DO NOT change any citations (e.g., [12], (Author, 2023)) or references.
    4. DO NOT change experimental data, numbers, or specific results.
    5. Maintain the original meaning and logical structure of the argument.
    6. Improve the 'human-like' qualities: use varied sentence lengths, appropriate transitional phrases, and a natural academic style.

    OUTPUT: Provide ONLY the rewritten text, no explanations, no preamble, and no 'Here is the rewritten text' message."""

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ],
        "temperature": 0.7 if level == "low" else (0.85 if level == "medium" else 1.0),
        "max_tokens": 2000
    }

    try:
        logger.info(f"Calling Groq API with model: {MODEL_NAME}", extra={"extra_data": {"level": level, "text_length": len(text)}})
        response = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=20)

        if response.status_code != 200:
            logger.warning(
                f"Groq API error ({response.status_code}), switching to fallback",
                extra={"extra_data": {"status_code": response.status_code, "response_text": response.text[:500]}},
            )
            return _simulated_rewrite(text)

        result = response.json()
        rewritten = result['choices'][0]['message']['content'].strip()
        logger.info("Groq API rewrite succeeded", extra={"extra_data": {"rewritten_length": len(rewritten)}})
        return rewritten

    except Exception as e:
        logger.error(f"Groq API call failed: {str(e)}, switching to fallback", exc_info=True)
        return _simulated_rewrite(text)
