import re
from typing import Tuple


WORD_BOUNDARY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_'-]*$")


class CasePreserver:
    @staticmethod
    def detect_case(word: str) -> str:
        if not word:
            return "lower"
        if "_" in word:
            if word.isupper():
                return "screaming_snake"
            if word.lower() == word:
                return "snake"
            return "mixed_snake"
        if WORD_BOUNDARY_RE.match(word):
            if word.isupper():
                return "upper"
            if word.islower():
                return "lower"
            if word.istitle():
                return "title"
            if word[:1].isupper() and any(c.isupper() for c in word[1:]) and any(c.islower() for c in word):
                return "pascal"
            if word[:1].islower() and any(c.isupper() for c in word[1:]):
                return "camel"
            if any(c.isupper() for c in word) and any(c.islower() for c in word):
                return "mixed"
        return "other"

    @staticmethod
    def _to_snake(text: str) -> str:
        normalized = text.replace("-", "_").replace(" ", "_")
        s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", normalized)
        s2 = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1)
        s3 = re.sub(r"_+", "_", s2)
        return s3.lower()

    @staticmethod
    def _split_words(text: str) -> list:
        snake = CasePreserver._to_snake(text)
        return [w for w in snake.split("_") if w]

    @staticmethod
    def apply_case(replacement: str, original_word: str) -> str:
        case_style = CasePreserver.detect_case(original_word)
        if not replacement:
            return original_word
        rep_words = CasePreserver._split_words(replacement)
        if not rep_words:
            rep_words = [replacement.lower()]

        if case_style == "upper":
            return replacement.upper()
        if case_style == "lower":
            return replacement.lower()
        if case_style == "title":
            return replacement[:1].upper() + replacement[1:].lower()
        if case_style == "pascal":
            return "".join(w[:1].upper() + w[1:].lower() for w in rep_words)
        if case_style == "screaming_snake":
            return "_".join(w.upper() for w in rep_words)
        if case_style == "snake":
            return "_".join(w.lower() for w in rep_words)
        if case_style == "camel":
            first = rep_words[0].lower()
            rest = "".join(w[:1].upper() + w[1:].lower() for w in rep_words[1:])
            return first + rest
        if case_style == "mixed_snake":
            return "_".join(w[:1].upper() + w[1:].lower() for w in rep_words)
        if case_style == "mixed":
            return replacement[:1].upper() + replacement[1:].lower()
        return replacement

    @staticmethod
    def preserve_multiword(replacement: str, original_text: str) -> str:
        if not original_text.strip():
            return replacement
        first_char = original_text[0]
        if first_char.isupper():
            return replacement[:1].upper() + replacement[1:]
        return replacement[:1].lower() + replacement[1:]

    @staticmethod
    def is_word_boundary_ok(text: str, start: int, end: int) -> bool:
        before_ok = True
        if start > 0:
            before_ch = text[start - 1]
            before_ok = not (before_ch.isalnum() or before_ch == "_")
        after_ok = True
        if end < len(text):
            after_ch = text[end]
            after_ok = not (after_ch.isalnum() or after_ch == "_")
        return before_ok and after_ok

    @staticmethod
    def match_and_replace(
        text: str, start: int, end: int, pattern: str, replacement: str
    ) -> Tuple[bool, str]:
        original = text[start:end]
        if original.lower() != pattern.lower():
            return False, text
        if len(pattern.split()) == 1:
            if not CasePreserver.is_word_boundary_ok(text, start, end):
                return False, text
            new_word = CasePreserver.apply_case(replacement, original)
        else:
            new_word = CasePreserver.preserve_multiword(replacement, original)
        return True, text[:start] + new_word + text[end:]
