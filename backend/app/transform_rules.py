import re
import random
from typing import List, Callable
from abc import ABC, abstractmethod


class SentenceTransformRule(ABC):
    @abstractmethod
    def name(self) -> str:
        ...

    @abstractmethod
    def apply(self, text: str) -> str:
        ...

    @staticmethod
    def split_sentences(text: str) -> List[str]:
        parts = re.split(r"(?<=[.!?])\s+", text)
        result = []
        buffer = ""
        for part in parts:
            buffer += part
            if buffer.strip():
                if re.search(r"[.!?]\s*$", buffer) or part == parts[-1]:
                    result.append(buffer)
                    buffer = ""
                else:
                    buffer += " "
        if buffer.strip():
            result.append(buffer)
        return result

    @staticmethod
    def join_sentences(sentences: List[str]) -> str:
        return " ".join(s.strip() for s in sentences if s.strip())


class PassiveActiveTransform(SentenceTransformRule):
    BY_PHRASE_RE = re.compile(
        r"\b(is|are|was|were|be|been|being)\s+([a-z]+ed|[a-z]+en)\s+by\s+([a-zA-Z_][\w\s'-]*?)([,.!?]|$)",
        re.IGNORECASE,
    )
    PASSIVE_RE = re.compile(
        r"\b(is|are|was|were)\s+([a-z]+ed|[a-z]+en)\b",
        re.IGNORECASE,
    )

    def name(self) -> str:
        return "passive_to_active"

    def apply(self, text: str) -> str:
        sentences = self.split_sentences(text)
        transformed = []
        for sent in sentences:
            match = self.BY_PHRASE_RE.search(sent)
            if match:
                aux, past_participle, doer, tail = match.groups()
                doer = doer.strip()
                if doer and len(doer.split()) <= 5:
                    patient = sent[: match.start()].strip()
                    rest_after = sent[match.end():].rstrip(".,!?;:").strip()
                    doer_cap = doer[:1].upper() + doer[1:]
                    verb_lower = past_participle.lower()
                    base_verb = self._strip_ed(verb_lower)
                    if aux.lower() in ("is", "are"):
                        verb = base_verb + ("s" if aux.lower() == "is" else "")
                    else:
                        verb = base_verb if base_verb.endswith("e") else base_verb + "ed"
                        if aux.lower() == "were":
                            pass
                    patient_lower = patient[:1].lower() + patient[1:] if patient else patient
                    middle = f"{verb} {patient_lower}" if patient_lower else verb
                    if rest_after:
                        new_sent = f"{doer_cap} {middle} {rest_after}{tail}"
                    else:
                        new_sent = f"{doer_cap} {middle}{tail}"
                    transformed.append(new_sent.strip())
                    continue
            transformed.append(sent)
        return self.join_sentences(transformed)

    @staticmethod
    def _strip_ed(verb: str) -> str:
        if verb.endswith("ied"):
            return verb[:-3] + "y"
        if verb.endswith("ed"):
            return verb[:-2]
        if verb.endswith("en"):
            return verb[:-2]
        return verb


class CompoundSplitTransform(SentenceTransformRule):
    CONJUNCTIONS = [" and ", " but ", " so ", ";", " while ", " whereas "]

    def name(self) -> str:
        return "compound_split"

    def apply(self, text: str) -> str:
        sentences = self.split_sentences(text)
        transformed = []
        for sent in sentences:
            parts = self._split_conjunction(sent)
            if len(parts) >= 2:
                for i, p in enumerate(parts):
                    p = p.strip().rstrip(",;").strip()
                    if not p:
                        continue
                    if i == 0:
                        p = p[:1].upper() + p[1:] if p else p
                    else:
                        p = p[:1].lower() + p[1:] if p else p
                        p = p[:1].upper() + p[1:]
                    if not re.search(r"[.!?]$", p):
                        p = p.rstrip() + "."
                    transformed.append(p)
            else:
                transformed.append(sent)
        return self.join_sentences(transformed)

    def _split_conjunction(self, sentence: str) -> List[str]:
        if len(sentence.split()) < 20:
            return [sentence]
        indices = []
        lowered = sentence.lower()
        for conj in self.CONJUNCTIONS:
            pos = 0
            while True:
                idx = lowered.find(conj, pos)
                if idx == -1:
                    break
                indices.append((idx, len(conj)))
                pos = idx + 1
        if not indices:
            return [sentence]
        indices.sort()
        idx, conj_len = indices[len(indices) // 2]
        first = sentence[:idx]
        second = sentence[idx + conj_len:]
        if len(first.split()) < 5 or len(second.split()) < 5:
            return [sentence]
        return [first, second]


class TransitionPhraseTransform(SentenceTransformRule):
    TRANSITIONS_BEGINNING = [
        "Notably, ",
        "Interestingly, ",
        "Importantly, ",
        "Furthermore, ",
        "Consequently, ",
        "In particular, ",
        "Specifically, ",
        "Indeed, ",
        "Moreover, ",
        "Significantly, ",
    ]
    TRANSITIONS_MIDDLE = [
        " in fact ",
        " specifically ",
        " in particular ",
        " particularly ",
        " indeed ",
        " notably ",
    ]

    def __init__(self, seed: int = 42):
        self._rng = random.Random(seed)

    def name(self) -> str:
        return "insert_transition_phrases"

    def apply(self, text: str) -> str:
        sentences = self.split_sentences(text)
        if len(sentences) < 3:
            return text
        transformed = []
        for i, sent in enumerate(sentences):
            processed = sent
            if i > 0 and not self._has_transition(sent) and self._rng.random() < 0.35:
                transition = self._rng.choice(self.TRANSITIONS_BEGINNING)
                first_lower = processed[:1].lower() + processed[1:]
                processed = transition + first_lower
            elif self._rng.random() < 0.15:
                processed = self._insert_mid(processed)
            transformed.append(processed)
        return self.join_sentences(transformed)

    @staticmethod
    def _has_transition(sentence: str) -> bool:
        starts = [
            "however", "therefore", "furthermore", "thus", "consequently",
            "moreover", "nevertheless", "notably", "interestingly", "importantly",
            "in particular", "specifically", "indeed", "significantly",
        ]
        lowered = sentence.strip().lower()
        return any(lowered.startswith(s) for s in starts)

    def _insert_mid(self, sentence: str) -> str:
        clauses = re.split(r"(, )", sentence)
        if len(clauses) >= 3:
            insert_at = 2
            transition = self._rng.choice(self.TRANSITIONS_MIDDLE)
            clauses.insert(insert_at, transition)
            return "".join(clauses)
        return sentence


class ClauseReorderTransform(SentenceTransformRule):
    LEADING_ADVERBIAL = re.compile(
        r"^(However|Therefore|Furthermore|Moreover|Thus|Consequently|Nevertheless|Hence|Additionally|Subsequently),"
        r"\s+(.*)$",
        re.IGNORECASE,
    )

    def name(self) -> str:
        return "clause_reorder"

    def apply(self, text: str) -> str:
        sentences = self.split_sentences(text)
        transformed = []
        for sent in sentences:
            match = self.LEADING_ADVERBIAL.match(sent.strip())
            if match:
                adverb, rest = match.groups()
                rest = rest.strip()
                if rest:
                    rest = rest[:1].upper() + rest[1:]
                    adverb_lower = adverb.lower()
                    if not re.search(r"[.!?]$", rest):
                        new_sent = f"{rest}, {adverb_lower}."
                    else:
                        punct = rest[-1]
                        body = rest[:-1]
                        new_sent = f"{body}, {adverb_lower}{punct}"
                    transformed.append(new_sent)
                    continue
            transformed.append(sent)
        return self.join_sentences(transformed)


class TransformEngine:
    def __init__(self, rules: List[SentenceTransformRule] = None, seed: int = 42):
        self.rules = rules or [
            PassiveActiveTransform(),
            CompoundSplitTransform(),
            TransitionPhraseTransform(seed=seed),
            ClauseReorderTransform(),
        ]

    def apply_all(self, text: str) -> str:
        current = text
        for rule in self.rules:
            current = rule.apply(current)
        return current

    def apply_subset(self, text: str, rule_names: List[str]) -> str:
        current = text
        for rule in self.rules:
            if rule.name() in rule_names:
                current = rule.apply(current)
        return current
