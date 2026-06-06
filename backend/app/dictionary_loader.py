import json
import os
from typing import Dict, List, Optional
from dataclasses import dataclass, field


@dataclass
class Dictionary:
    name: str
    description: str = ""
    keywords: List[str] = field(default_factory=list)
    synonyms: Dict[str, str] = field(default_factory=dict)
    phrases: Dict[str, str] = field(default_factory=dict)

    def merge(self, other: "Dictionary") -> "Dictionary":
        merged = Dictionary(
            name=f"{self.name}+{other.name}",
            description=f"{self.description} + {other.description}",
            keywords=list(set(self.keywords + other.keywords)),
            synonyms={**self.synonyms, **other.synonyms},
            phrases={**self.phrases, **other.phrases},
        )
        return merged

    def all_patterns(self) -> Dict[str, str]:
        patterns = {}
        for phrase, replacement in self.phrases.items():
            patterns[phrase.lower()] = replacement
        for word, replacement in self.synonyms.items():
            patterns[word.lower()] = replacement
        return patterns


class DictionaryLoader:
    DEFAULT_DICT_DIR = os.path.join(os.path.dirname(__file__), "dictionaries")

    def __init__(self, dict_dir: Optional[str] = None):
        self.dict_dir = dict_dir or self.DEFAULT_DICT_DIR
        self._cache: Dict[str, Dictionary] = {}

    def list_available(self) -> List[str]:
        if not os.path.isdir(self.dict_dir):
            return []
        names = []
        for fname in os.listdir(self.dict_dir):
            if fname.endswith(".json"):
                names.append(fname[:-5])
        return sorted(names)

    def load(self, name: str) -> Dictionary:
        if name in self._cache:
            return self._cache[name]
        path = os.path.join(self.dict_dir, f"{name}.json")
        if not os.path.isfile(path):
            raise FileNotFoundError(f"Dictionary not found: {name} at {path}")
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        d = Dictionary(
            name=data.get("name", name),
            description=data.get("description", ""),
            keywords=[k.lower() for k in data.get("keywords", [])],
            synonyms={k.lower(): v for k, v in data.get("synonyms", {}).items()},
            phrases={k.lower(): v for k, v in data.get("phrases", {}).items()},
        )
        self._cache[name] = d
        return d

    def load_all(self) -> Dict[str, Dictionary]:
        result = {}
        for name in self.list_available():
            result[name] = self.load(name)
        return result

    def auto_detect(self, text: str) -> List[str]:
        text_lower = text.lower()
        scores: Dict[str, int] = {}
        for name in self.list_available():
            d = self.load(name)
            score = 0
            for kw in d.keywords:
                if kw in text_lower:
                    score += 1
            if score > 0:
                scores[name] = score
        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [name for name, _ in ranked]

    def load_for_text(self, text: str, explicit: Optional[str] = None) -> Dictionary:
        if explicit:
            base = self.load(explicit)
        else:
            detected = self.auto_detect(text)
            if detected:
                base = self.load(detected[0])
                for extra_name in detected[1:]:
                    base = base.merge(self.load(extra_name))
            else:
                base = Dictionary(name="empty")
        try:
            general = self.load("general")
            base = general.merge(base)
        except FileNotFoundError:
            pass
        return base
