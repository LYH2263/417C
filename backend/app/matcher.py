from collections import deque
from typing import Dict, List, Tuple


class Node:
    __slots__ = ("children", "fail", "output", "depth")

    def __init__(self):
        self.children: Dict[str, "Node"] = {}
        self.fail: "Node" = self
        self.output: List[Tuple[str, str]] = []
        self.depth: int = 0


class AhoCorasickMatcher:
    def __init__(self, patterns: Dict[str, str]):
        self.root = Node()
        self._build(patterns)

    def _build(self, patterns: Dict[str, str]) -> None:
        for pattern, replacement in patterns.items():
            node = self.root
            for i, ch in enumerate(pattern):
                if ch not in node.children:
                    child = Node()
                    child.depth = i + 1
                    node.children[ch] = child
                node = node.children[ch]
            node.output.append((pattern, replacement))

        queue = deque()
        for ch, child in self.root.children.items():
            child.fail = self.root
            queue.append(child)

        while queue:
            current_node = queue.popleft()
            for ch, child in current_node.children.items():
                fail_node = current_node.fail
                while fail_node is not self.root and ch not in fail_node.children:
                    fail_node = fail_node.fail
                if ch in fail_node.children and fail_node.children[ch] is not child:
                    child.fail = fail_node.children[ch]
                else:
                    child.fail = self.root
                if child.fail.output:
                    child.output = child.output + child.fail.output
                queue.append(child)

    def search(self, text: str) -> List[Tuple[int, int, str, str]]:
        results = []
        node = self.root
        for idx, ch in enumerate(text):
            ch_lower = ch.lower()
            while node is not self.root and ch_lower not in node.children:
                node = node.fail
            if ch_lower in node.children:
                node = node.children[ch_lower]
            else:
                node = self.root
            if node.output:
                for pattern, replacement in node.output:
                    start = idx - len(pattern) + 1
                    results.append((start, idx + 1, pattern, replacement))
        return self._resolve_overlaps(results)

    @staticmethod
    def _resolve_overlaps(
        matches: List[Tuple[int, int, str, str]]
    ) -> List[Tuple[int, int, str, str]]:
        if not matches:
            return []
        matches.sort(key=lambda m: (m[0], -(m[1] - m[0])))
        resolved = []
        last_end = -1
        for start, end, pattern, replacement in matches:
            if start >= last_end:
                resolved.append((start, end, pattern, replacement))
                last_end = end
        return resolved


class TrieMatcher:
    def __init__(self, patterns: Dict[str, str]):
        self.root: Dict = {}
        self._build(patterns)

    def _build(self, patterns: Dict[str, str]) -> None:
        for pattern, replacement in patterns.items():
            node = self.root
            for ch in pattern:
                if ch not in node:
                    node[ch] = {}
                node = node[ch]
            node["__value__"] = (pattern, replacement)

    def search(self, text: str) -> List[Tuple[int, int, str, str]]:
        results = []
        n = len(text)
        i = 0
        while i < n:
            node = self.root
            j = i
            best = None
            while j < n and text[j].lower() in node:
                node = node[text[j].lower()]
                j += 1
                if "__value__" in node:
                    best = (i, j, node["__value__"][0], node["__value__"][1])
            if best:
                results.append(best)
                i = best[1]
            else:
                i += 1
        return results
