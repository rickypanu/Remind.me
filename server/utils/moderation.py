"""
Content moderation for reminders / tasks.

A fast, deterministic, offline filter (no API call, no quota, no latency) that rejects
text containing sexual, vulgar, hateful or clearly harmful content. It is used by:

  * POST /tasks/            (manual create form)
  * POST /tasks/magic-add   (natural-language input, checked both before and after the AI parses it)

How it works
------------
1. The text is normalised: accents removed, lower-cased, "f u c k" / "f.u.c.k" joined,
   and a second "leetspeak" variant ("5h1t", "a$$hole", "f*ck") is built.
2. Each blocked word is matched as a WHOLE word (so "class", "Scunthorpe" or "shiitake"
   are not flagged) and tolerates stretched letters ("fuuuck") and common suffixes.
3. A small set of regex phrases catches threats, self-harm, weapons and drug dealing.

Tune the lists below to your audience. Keep them short and specific: broad lists create
false positives for a student app (e.g. "sex education" or "kill the process" must pass).
"""
import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable, List, Optional

from fastapi import HTTPException, status

# --------------------------------------------------------------------------
# Word lists (matched as whole words)
# --------------------------------------------------------------------------
_VULGAR_WORDS = [
    "fuck", "fucker", "fucking", "fucked", "motherfucker", "fuk", "fck", "shit", "bullshit", "shitty",
    "bitch", "bitches", "asshole", "arsehole", "dumbass", "jackass", "bastard", "cunt", "dickhead",
    "prick", "twat", "wanker", "bollocks", "douchebag", "piss off", "son of a bitch",
    # Hindi / Hinglish
    "madarchod", "maderchod", "behenchod", "bhenchod", "bhosdike", "bhosdi", "bhosda", "chutiya",
    "chutiye", "chut", "gandu", "gaandu", "randi", "lauda", "lund", "harami", "kamina", "kutta", "kutiya",
    "madharchod", "bhosadike", "chutiyapa",
]

_SEXUAL_WORDS = [
    "porn", "porno", "pornography", "pornhub", "xxx", "nude", "nudes", "naked pics", "blowjob", "handjob",
    "cumshot", "orgasm", "masturbate", "masturbation", "masturbating", "dildo", "vibrator", "erotic",
    "hentai", "sexting", "sex tape", "sex video", "sex videos", "onlyfans", "escort service", "boobs", "tits",
    "pussy", "slut", "whore", "hooker", "nsfw", "milf", "fetish", "bdsm", "threesome", "orgy", "gangbang",
    "horny", "anal sex", "oral sex", "have sex", "hookup",
]

_HATE_WORDS = [
    "nigger", "nigga", "faggot", "fag", "retard", "retarded", "kike", "chink", "spic", "tranny", "paki",
    "coon", "gook", "wetback",
]

# --------------------------------------------------------------------------
# Phrase patterns (regex, already lower-case, applied to normalised text)
# --------------------------------------------------------------------------
_HARM_PATTERNS = [
    r"\b(kill|murder|shoot|stab|strangle|poison|hurt|beat up|assault|rape)\s+(him|her|them|you|u|someone|somebody|everyone|people|a person|(?:(?:my|the|our)\s+)?(?:teacher|professor|boss|friend|brother|sister|mom|dad|mother|father|classmate|neighbou?r|roommate|wife|husband|girlfriend|boyfriend))\b",
    r"\b(make|build|plant|assemble)\s+(a\s+)?(bomb|explosive|ied|molotov|pipe bomb)\b",
    r"\b(school|mass)\s+shooting\b",
    r"\bterror(ist)?\s+attack\b",
    r"\b(buy|sell|score|deal|smuggle)\s+(some\s+)?(weed|cocaine|heroin|meth|mdma|lsd|ganja|charas|drugs)\b",
    r"\b(stalk|doxx?|dox)\s+(him|her|them|someone|my)\b",
    r"\bchild\s+(porn|abuse material|sexual)\b",
]
_SELF_HARM_PATTERNS = [
    r"\bkill\s+(myself|me)\b",
    r"\bend\s+(my|it all|my own)\s+life\b",
    r"\bcommit\s+suicide\b",
    r"\bsuicide\s+(plan|note|method|methods)\b",
    r"\bhurt\s+myself\b",
    r"\bcut\s+myself\b",
    r"\bwant\s+to\s+die\b",
]

CATEGORY_MESSAGES = {
    "vulgar": "Please remove the offensive language. Reminders can't contain vulgar or abusive words.",
    "sexual": "This reminder contains sexual content, which isn't allowed. Please reword it.",
    "hate": "This reminder contains hateful language, which isn't allowed. Please reword it.",
    "harmful": "This reminder looks harmful or promotes violence or illegal activity, so it can't be saved.",
    "self_harm": (
        "We can't save this reminder. If you're having a hard time, please talk to someone you trust "
        "or a helpline (in India, Tele-MANAS: 14416). You matter."
    ),
    "ai_flagged": "This reminder was flagged as inappropriate, so it can't be saved. Please reword it.",
}

_LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i", "+": "t", "|": "i"})
_VOWELS = "aeiou"


@dataclass(frozen=True)
class ModerationResult:
    allowed: bool
    category: Optional[str] = None
    message: Optional[str] = None


def _stretchy(word: str) -> str:
    """'fuck' -> 'f+u+c+k+' (tolerates 'fuuuck'); spaces in phrases match any run of spaces."""
    parts = []
    for ch in word:
        parts.append(r"\s+" if ch == " " else re.escape(ch) + "+")
    return "".join(parts)


def _compile(words: Iterable[str], suffix: bool = True) -> re.Pattern:
    alts = "|".join(sorted((_stretchy(w) for w in set(words)), key=len, reverse=True))
    tail = r"(?:ing|er|ers|ed|s|es|in|y|ie|ies)?" if suffix else ""
    return re.compile(rf"(?<![a-z])(?:{alts}){tail}(?![a-z])")


_VULGAR_RE = _compile(_VULGAR_WORDS)
_SEXUAL_RE = _compile(_SEXUAL_WORDS)
_HATE_RE = _compile(_HATE_WORDS, suffix=False)
_HARM_RES = [re.compile(p) for p in _HARM_PATTERNS]
_SELF_HARM_RES = [re.compile(p) for p in _SELF_HARM_PATTERNS]

_SPACED_LETTERS_RE = re.compile(r"(?<![a-z])(?:[a-z][\s.\-_*]+){2,}[a-z](?![a-z])")


def _ascii_fold(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()


def _join_spaced_letters(text: str) -> str:
    """'f u c k' / 'f.u.c.k' -> 'fuck'."""
    return _SPACED_LETTERS_RE.sub(lambda m: re.sub(r"[\s.\-_*]+", "", m.group(0)), text)


def _variants(text: str) -> List[str]:
    base = _ascii_fold(text)
    out = {base, _join_spaced_letters(base)}
    leet = base.translate(_LEET)
    out.add(leet)
    out.add(_join_spaced_letters(leet))
    # "f*ck" / "sh*t": try every vowel in place of '*'
    if "*" in base:
        for v in _VOWELS:
            out.add(base.replace("*", v))
    # Treat leftover punctuation as separators so "fu-ck" style splits are not hidden by word boundaries
    out |= {re.sub(r"[^a-z\s]", " ", v) for v in list(out)}
    return list(out)


def check_text(*texts: Optional[str]) -> ModerationResult:
    """Return the first problem found across all the given strings (None / empty are ignored)."""
    for text in texts:
        if not text or not str(text).strip():
            continue
        raw = str(text)
        for v in _variants(raw):
            for rx in _SELF_HARM_RES:
                if rx.search(v):
                    return ModerationResult(False, "self_harm", CATEGORY_MESSAGES["self_harm"])
            if _HATE_RE.search(v):
                return ModerationResult(False, "hate", CATEGORY_MESSAGES["hate"])
            if _SEXUAL_RE.search(v):
                return ModerationResult(False, "sexual", CATEGORY_MESSAGES["sexual"])
            if _VULGAR_RE.search(v):
                return ModerationResult(False, "vulgar", CATEGORY_MESSAGES["vulgar"])
            for rx in _HARM_RES:
                if rx.search(v):
                    return ModerationResult(False, "harmful", CATEGORY_MESSAGES["harmful"])
    return ModerationResult(True)


def enforce(*texts: Optional[str]) -> None:
    """Raise HTTP 422 (with a user-facing message in `detail`) if any text is not allowed."""
    result = check_text(*texts)
    if not result.allowed:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=result.message)


def reject_ai_flagged() -> None:
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=CATEGORY_MESSAGES["ai_flagged"])
