"""Rule-based Quick Add parser (no AI, no network, no quota). A line-by-line port of the app/website parser
(`quickParse.js` + `typos.js` + `localWords.js` + `categoryModel.js`), so the server reads a sentence the same way the phone does.

    "gym every monday and thursday 7am"  -> weekly, Mon + Thu, 07:00
    "kal sham 6 baje maths assignment"   -> once, tomorrow 18:00
    "submit report"                      -> once, the next clean half-hour slot about 2 hours ahead (never 10:33 pm)
    "I need to remember to bring my charger for tomorrows exam at 9" -> "Bring charger for exam", tomorrow 09:00

The reminder has a TITLE ONLY (description is always None). The server keeps no "usual times" (habits): those live on the
device, so the app / website pass them to their own parser only.

Everything is IST (UTC+05:30). Keep this file and the JS parser in step; tests/test_quick_parse.py compares them.
Regexes use re.ASCII on purpose: JavaScript's \\b, \\w and \\d are ASCII-only and the two parsers must agree.
"""

from __future__ import annotations

import math
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Any

A = re.ASCII
IST_OFFSET_MS = 330 * 60 * 1000
MIN = 60 * 1000
HOUR = 60 * MIN
DAY = 24 * HOUR
DEFAULT_LEAD_MS = 2 * HOUR
SLOT_MS = 30 * MIN  # a default time is always on the hour or half hour
EARLIEST_DEFAULT_HOUR = 7  # a default reminder never rings before 7 am ...
LATEST_DEFAULT_HOUR = 22  # ... or from 10 pm on: those wait for 9 am
DEFAULT_TIME_ON_FUTURE_DAY = (9, 0)

_MOMENTS = {
    "before breakfast": (7, 30), "after breakfast": (9, 30), "before lunch": (12, 30), "after lunch": (13, 30),
    "before dinner": (19, 30), "after dinner": (21, 0), "before bed": (22, 30), "end of day": (17, 0),
}
_MOMENT_RE = r"\b(?:(before|after)\s+(breakfast|lunch|dinner|supper|bed(?:\s*time)?|sleeping|sleep)|(bed\s*time)|(end\s+of\s+(?:the\s+)?day|eod))\b"
_KEYWORD_CLOCKS = [
    (r"\bbreakfast\b", (8, 30)),
    (r"\blunch\b", (13, 0)),
    (r"\b(?:dinner|supper)\b", (20, 0)),
    (r"\b(?:call|phone|ring|movie|party|catch up|hangout)\b", (18, 0)),
]
_AM_WORDS = r"\b(?:wake|wakeup|alarm|jog\w*|yoga|breakfast|meditat\w*|school|namaz|puja)\b"
_PM_WORDS = r"\b(?:dinner|supper|party|movie|concert|date|drinks|netflix|tv)\b"

# ---------------------------------------------------------------------------------------------------
# Unicode helpers (JS uses \p{L} \p{M} \p{N}; Python's re has no such classes)
# ---------------------------------------------------------------------------------------------------


def _is(ch: str, cats: str) -> bool:
    return unicodedata.category(ch)[0] in cats


def _runs(text: str, cats: str, min_len: int = 1):
    """(start, end) of every run of characters whose Unicode major category is in ``cats`` ("LM", "LN"...)."""
    i, n = 0, len(text)
    while i < n:
        if _is(text[i], cats):
            j = i
            while j < n and _is(text[j], cats):
                j += 1
            if j - i >= min_len:
                yield i, j
            i = j
        else:
            i += 1


# ---------------------------------------------------------------------------------------------------
# Layer 0: Indian-language words -> the English words the parser knows (localWords.js)
# ---------------------------------------------------------------------------------------------------
_GROUPS = {
    "today": "today", "tomorrow": "tomorrow", "after2": "day after tomorrow",
    "morning": "morning", "noon": "afternoon", "evening": "evening", "night": "night",
    "baje": "baje", "daily": "every day", "weekly": "every week", "min": "min", "hour": "hours", "baad": "baad",
    "mon": "monday", "tue": "tuesday", "wed": "wednesday", "thu": "thursday", "fri": "friday", "sat": "saturday", "sun": "sunday",
}

# (suffix_language, {group: [native words]})
_SETS: list[tuple[bool, dict[str, list[str]]]] = [
    (False, {  # Hindi + Marathi
        "today": ["आज"], "tomorrow": ["कल", "उद्या"], "after2": ["परसों", "परसो", "परवा"],
        "morning": ["सुबह", "सवेरे", "सकाळी", "सकाळ"], "noon": ["दोपहर", "दुपारी"], "evening": ["शाम", "संध्याकाळी", "संध्याकाळ"], "night": ["रात्री", "रात"],
        "baje": ["बजे", "वाजता", "वाजले"], "daily": ["हर दिन", "हर रोज़", "हर रोज", "रोज़ाना", "रोजाना", "रोज़", "रोज", "दररोज", "रोज"], "weekly": ["हर हफ्ते", "हर सप्ताह", "दर आठवड्याला", "दर आठवड्यात"],
        "min": ["मिनट", "मिनिटांनी", "मिनिटांत", "मिनिटे", "मिनिट"], "hour": ["घंटे", "घंटा", "घण्टे", "तासांनी", "तास"], "baad": ["बाद", "में", "नंतर"],
        "mon": ["सोमवार"], "tue": ["मंगलवार", "मंगळवार"], "wed": ["बुधवार"], "thu": ["गुरुवार", "बृहस्पतिवार", "वीरवार"], "fri": ["शुक्रवार"], "sat": ["शनिवार"], "sun": ["रविवार", "इतवार"],
    }),
    (False, {  # Bengali
        "today": ["আজ"], "tomorrow": ["কাল"], "after2": ["পরশু"], "morning": ["সকালে", "সকাল"], "noon": ["দুপুরে", "দুপুর"], "evening": ["সন্ধ্যায়", "সন্ধ্যা", "বিকেলে", "বিকেল"], "night": ["রাতে", "রাত"],
        "baje": ["টায়", "টার"], "daily": ["প্রতিদিন", "রোজ"], "weekly": ["প্রতি সপ্তাহে", "প্রতি সপ্তাহ"], "min": ["মিনিট"], "hour": ["ঘণ্টা", "ঘন্টা"], "baad": ["পরে", "বাদে"],
        "mon": ["সোমবার"], "tue": ["মঙ্গলবার"], "wed": ["বুধবার"], "thu": ["বৃহস্পতিবার"], "fri": ["শুক্রবার"], "sat": ["শনিবার"], "sun": ["রবিবার"],
    }),
    (False, {  # Assamese
        "today": ["আজি"], "tomorrow": ["কালি"], "after2": ["পৰহি"], "morning": ["ৰাতিপুৱা"], "noon": ["দুপৰীয়া"], "evening": ["গধূলি", "সন্ধিয়া"], "night": ["ৰাতি"],
        "baje": ["বজাত", "বজে"], "daily": ["প্ৰতিদিনে", "প্ৰতিদিন"], "weekly": ["প্ৰতি সপ্তাহে"], "min": ["মিনিট"], "hour": ["ঘণ্টা", "ঘন্টা"], "baad": ["পিছত"],
        "mon": ["সোমবাৰ"], "tue": ["মঙ্গলবাৰ"], "wed": ["বুধবাৰ"], "thu": ["বৃহস্পতিবাৰ"], "fri": ["শুকুৰবাৰ"], "sat": ["শনিবাৰ"], "sun": ["দেওবাৰ"],
    }),
    (False, {  # Gujarati
        "today": ["આજે", "આજ"], "tomorrow": ["કાલે", "કાલ"], "after2": ["પરમદિવસે", "પરમ દિવસે"], "morning": ["સવારે", "સવાર"], "noon": ["બપોરે", "બપોર"], "evening": ["સાંજે", "સાંજ"], "night": ["રાત્રે", "રાતે", "રાત"],
        "baje": ["વાગ્યે", "વાગે"], "daily": ["દરરોજ", "રોજ"], "weekly": ["દર અઠવાડિયે", "દર અઠવાડિયા"], "min": ["મિનિટ"], "hour": ["કલાક"], "baad": ["પછી"],
        "mon": ["સોમવાર"], "tue": ["મંગળવાર"], "wed": ["બુધવાર"], "thu": ["ગુરુવાર"], "fri": ["શુક્રવાર"], "sat": ["શનિવાર"], "sun": ["રવિવાર"],
    }),
    (False, {  # Punjabi
        "today": ["ਅੱਜ"], "tomorrow": ["ਕੱਲ੍ਹ", "ਕੱਲ"], "after2": ["ਪਰਸੋਂ"], "morning": ["ਸਵੇਰੇ", "ਸਵੇਰ"], "noon": ["ਦੁਪਹਿਰ"], "evening": ["ਸ਼ਾਮ"], "night": ["ਰਾਤ"],
        "baje": ["ਵਜੇ"], "daily": ["ਹਰ ਰੋਜ਼", "ਹਰ ਦਿਨ", "ਰੋਜ਼"], "weekly": ["ਹਰ ਹਫ਼ਤੇ", "ਹਰ ਹਫਤੇ"], "min": ["ਮਿੰਟ"], "hour": ["ਘੰਟੇ", "ਘੰਟਾ"], "baad": ["ਬਾਅਦ"],
        "mon": ["ਸੋਮਵਾਰ"], "tue": ["ਮੰਗਲਵਾਰ"], "wed": ["ਬੁੱਧਵਾਰ"], "thu": ["ਵੀਰਵਾਰ"], "fri": ["ਸ਼ੁੱਕਰਵਾਰ"], "sat": ["ਸ਼ਨੀਵਾਰ"], "sun": ["ਐਤਵਾਰ"],
    }),
    (False, {  # Odia
        "today": ["ଆଜି"], "tomorrow": ["କାଲି"], "after2": ["ପରଶ୍ୱ", "ପରଶୁ"], "morning": ["ସକାଳେ", "ସକାଳ"], "noon": ["ଦିପହରେ", "ଦିପହର"], "evening": ["ସନ୍ଧ୍ୟାରେ", "ସନ୍ଧ୍ୟା"], "night": ["ରାତିରେ", "ରାତି"],
        "baje": ["ଟାରେ", "ବାଜିକି"], "daily": ["ପ୍ରତିଦିନ"], "weekly": ["ପ୍ରତି ସପ୍ତାହ"], "min": ["ମିନିଟ୍", "ମିନିଟ"], "hour": ["ଘଣ୍ଟା"], "baad": ["ପରେ"],
        "mon": ["ସୋମବାର"], "tue": ["ମଙ୍ଗଳବାର"], "wed": ["ବୁଧବାର"], "thu": ["ଗୁରୁବାର"], "fri": ["ଶୁକ୍ରବାର"], "sat": ["ଶନିବାର"], "sun": ["ରବିବାର"],
    }),
    (False, {  # Urdu
        "today": ["آج"], "tomorrow": ["کل"], "after2": ["پرسوں"], "morning": ["صبح"], "noon": ["دوپہر"], "evening": ["شام"], "night": ["رات"],
        "baje": ["بجے"], "daily": ["ہر روز", "روزانہ", "روز"], "weekly": ["ہر ہفتے", "ہر ہفتہ"], "min": ["منٹ"], "hour": ["گھنٹے", "گھنٹہ", "گھنٹا"], "baad": ["بعد"],
        "mon": ["پیر"], "tue": ["منگل"], "wed": ["بدھ"], "thu": ["جمعرات"], "fri": ["جمعہ"], "sat": ["ہفتہ"], "sun": ["اتوار"],
    }),
    (True, {  # Tamil
        "today": ["இன்று"], "tomorrow": ["நாளை"], "after2": ["நாளைமறுநாள்"], "morning": ["காலை"], "noon": ["மதியம்"], "evening": ["மாலை"], "night": ["இரவு"],
        "baje": ["மணிக்கு"], "daily": ["தினமும்", "ஒவ்வொரு நாளும்"], "weekly": ["ஒவ்வொரு வாரமும்"], "min": ["நிமிடங்கள்", "நிமிடம்", "நிமிடத்தில்"], "hour": ["மணி நேரம்", "மணிநேரம்"], "baad": ["பிறகு"],
        "mon": ["திங்கள்"], "tue": ["செவ்வாய்"], "wed": ["புதன்"], "thu": ["வியாழன்"], "fri": ["வெள்ளி"], "sat": ["சனி"], "sun": ["ஞாயிறு"],
    }),
    (True, {  # Telugu
        "today": ["ఈ రోజు", "ఈరోజు", "నేడు"], "tomorrow": ["రేపు"], "after2": ["ఎల్లుండి"], "morning": ["ఉదయం"], "noon": ["మధ్యాహ్నం"], "evening": ["సాయంత్రం"], "night": ["రాత్రి"],
        "baje": ["గంటలకు", "గంటకు"], "daily": ["ప్రతిరోజూ", "ప్రతి రోజు", "రోజూ"], "weekly": ["ప్రతి వారం"], "min": ["నిమిషాలు", "నిమిషం", "నిమిషాల"], "hour": ["గంటలు", "గంట"], "baad": ["తర్వాత"],
        "mon": ["సోమవారం"], "tue": ["మంగళవారం"], "wed": ["బుధవారం"], "thu": ["గురువారం"], "fri": ["శుక్రవారం"], "sat": ["శనివారం"], "sun": ["ఆదివారం"],
    }),
    (True, {  # Kannada
        "today": ["ಇಂದು"], "tomorrow": ["ನಾಳೆ"], "after2": ["ನಾಡಿದ್ದು"], "morning": ["ಬೆಳಿಗ್ಗೆ", "ಬೆಳಗ್ಗೆ"], "noon": ["ಮಧ್ಯಾಹ್ನ"], "evening": ["ಸಂಜೆ"], "night": ["ರಾತ್ರಿ"],
        "baje": ["ಗಂಟೆಗೆ"], "daily": ["ಪ್ರತಿದಿನ", "ಪ್ರತಿ ದಿನ"], "weekly": ["ಪ್ರತಿ ವಾರ"], "min": ["ನಿಮಿಷಗಳ", "ನಿಮಿಷ"], "hour": ["ಗಂಟೆಗಳ", "ಗಂಟೆ"], "baad": ["ನಂತರ"],
        "mon": ["ಸೋಮವಾರ"], "tue": ["ಮಂಗಳವಾರ"], "wed": ["ಬುಧವಾರ"], "thu": ["ಗುರುವಾರ"], "fri": ["ಶುಕ್ರವಾರ"], "sat": ["ಶನಿವಾರ"], "sun": ["ಭಾನುವಾರ"],
    }),
    (True, {  # Malayalam
        "today": ["ഇന്ന്"], "tomorrow": ["നാളെ"], "after2": ["മറ്റന്നാൾ"], "morning": ["രാവിലെ"], "noon": ["ഉച്ചയ്ക്ക്", "ഉച്ചക്ക്"], "evening": ["വൈകുന്നേരം"], "night": ["രാത്രി"],
        "baje": ["മണിക്ക്"], "daily": ["എല്ലാ ദിവസവും", "ദിവസവും"], "weekly": ["എല്ലാ ആഴ്ചയും"], "min": ["മിനിറ്റ്"], "hour": ["മണിക്കൂർ"], "baad": ["ശേഷം"],
        "mon": ["തിങ്കൾ"], "tue": ["ചൊവ്വ"], "wed": ["ബുധൻ"], "thu": ["വ്യാഴം"], "fri": ["വെള്ളി"], "sat": ["ശനി"], "sun": ["ഞായർ"],
    }),
]

_RULES: list[tuple[str, str, bool]] = []  # (native, english, suffix)
_BAAD: list[str] = []
for _suffix, _words_map in _SETS:
    for _key, _list in _words_map.items():
        if _key == "baad":
            _BAAD.extend(_list)
            continue
        for _native in _list:
            _RULES.append((_native, _GROUPS[_key], _suffix))
_RULES.sort(key=lambda r: -len(r[0]))  # longest first (stable, like JS sort)
_BAAD.sort(key=lambda w: -len(w))

_ZEROS = [0x660, 0x6F0, 0x966, 0x9E6, 0xA66, 0xAE6, 0xB66, 0xBE6, 0xC66, 0xCE6, 0xD66]


def _ascii_digits(text: str) -> str:
    out = []
    for ch in text:
        if unicodedata.category(ch) == "Nd":
            cp = ord(ch)
            if 48 <= cp <= 57:
                out.append(ch)
                continue
            for z in _ZEROS:
                if z <= cp <= z + 9:
                    out.append(str(cp - z))
                    break
            else:
                out.append(ch)
        else:
            out.append(ch)
    return "".join(out)


def _has_non_latin(text: str) -> bool:
    return any(ord(c) > 0x24F and not (0x2000 <= ord(c) <= 0x206F) for c in text)


def _replace_native(text: str, native: str, en: str, suffix: bool) -> str:
    """Replace `native` where it is not glued to a letter/mark on the left (and, unless suffix, on the right)."""
    out, i, n, m = [], 0, len(text), len(native)
    while True:
        j = text.find(native, i)
        if j < 0:
            out.append(text[i:])
            break
        before_ok = j == 0 or not _is(text[j - 1], "LM")
        end = j + m
        after_ok = suffix or end >= n or not _is(text[end], "LM")
        if before_ok and after_ok:
            out.append(text[i:j])
            out.append(f" {en} ")
            i = end
        else:
            out.append(text[i:j + 1])
            i = j + 1
    return "".join(out)


def normalize_local(text: str) -> str:
    s = str(text or "")
    if not _has_non_latin(s):
        return s
    s = _ascii_digits(s)
    for native, en, suffix in _RULES:
        s = _replace_native(s, native, en, suffix)
    s = re.sub(r"\s+", " ", s)
    # "30 min बाद" -> "30 min baad"
    out, i = [], 0
    for m in re.finditer(r"\b(?:min|hours)\s+", s, A):
        if m.start() < i:
            continue
        for w in _BAAD:
            if s.startswith(w, m.end()):
                end = m.end() + len(w)
                if end >= len(s) or not _is(s[end], "LM"):
                    out.append(s[i:m.end()])
                    out.append("baad")
                    i = end
                    break
    out.append(s[i:])
    return "".join(out).strip()


# ---------------------------------------------------------------------------------------------------
# Layer 1: typos and spoken numbers (typos.js)
# ---------------------------------------------------------------------------------------------------
_ALIASES: dict[str, str | None] = {
    "tmrw": "tomorrow", "tmr": "tomorrow", "tmrrw": "tomorrow", "tmorow": "tomorrow", "tomoro": "tomorrow", "tomorow": "tomorrow", "tommorow": "tomorrow",
    "tommorrow": "tomorrow", "tomorrw": "tomorrow", "2moro": "tomorrow", "2morrow": "tomorrow", "2mrw": "tomorrow",
    "tonite": "tonight", "tnite": "tonight", "2nite": "tonight", "tonit": "tonight",
    "kl": "kal", "kall": "kal", "aj": "aaj", "aajj": "aaj", "parsso": "parso", "parson": "parso",
    "saam": "sham", "shaam": "sham", "shyam": None,
    "suba": "subah", "subh": "subah", "savre": "savere", "subeh": "subah",
    "dopeher": "dopahar", "dopehar": "dopahar", "dupahar": "dopahar", "dopher": "dopahar", "dupher": "dopahar", "dophar": "dopahar",
    "raaat": "raat", "raath": "raat", "rat": None,
    "bje": "baje", "bajey": "baje", "bajae": "baje", "baajey": "baje", "bajhe": "baje", "baaje": "baje", "bajee": "baje", "bjy": "baje",
    "mins": "minutes", "min": "minutes", "mnts": "minutes", "mnt": "minutes", "minuts": "minutes", "minutess": "minutes", "mints": "minutes",
    "hrs": "hours", "hr": "hours", "hurs": "hours", "hrss": "hours",
    "nxt": "next", "nex": "next", "evry": "every", "evey": "every", "evary": "every", "evrey": "every", "evrry": "every",
    "dailly": "daily", "dayly": "daily", "daly": "daily", "dly": "daily", "wkly": "weekly", "weakly": "weekly", "weekley": "weekly",
    "wknd": "weekend", "wkend": "weekend", "wknds": "weekends", "wkends": "weekends",
}
_VOCAB = [
    "tomorrow", "today", "tonight", "morning", "afternoon", "evening", "midnight", "night",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "weekdays", "weekends", "weekly", "daily", "every", "minutes", "minute", "hours",
    "somvar", "mangalvar", "budhvar", "guruvar", "shukravar", "shanivar", "ravivar",
    "subah", "savere", "dopahar", "shaam", "raat",
]
_PROTECT = {
    "dairy", "mourning", "sundae", "sundays", "mondays", "fridays", "weakly", "toady", "tidy", "midnights", "eventing",
    "hourly", "morons", "mornings", "evenings", "nights", "tonights", "minuets", "minute", "avery",
}
_VOCAB_SET = set(_VOCAB)


def _distance(a: str, b: str) -> int:
    al, bl = len(a), len(b)
    if abs(al - bl) > 2:
        return 3
    d = [[0] * (bl + 1) for _ in range(al + 1)]
    for i in range(al + 1):
        d[i][0] = i
    for j in range(bl + 1):
        d[0][j] = j
    for i in range(1, al + 1):
        for j in range(1, bl + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)
    return d[al][bl]


def _nearest_word(token: str) -> str | None:
    if len(token) < 5 or token in _VOCAB_SET or token in _PROTECT:
        return None
    best, best_dist, tie = None, 9, False
    for word in _VOCAB:
        if word[0] != token[0]:
            continue
        allowed = 2 if len(word) >= 8 and len(token) >= 6 else 1
        dist = _distance(token, word)
        if dist > allowed:
            continue
        if dist < best_dist:
            best, best_dist, tie = word, dist, False
        elif dist == best_dist and word != best:
            tie = True
    return None if tie else best


_NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "fifteen": 15, "twenty": 20, "thirty": 30,
    "ek": 1, "do": 2, "teen": 3, "char": 4, "chaar": 4, "paanch": 5, "panch": 5, "chhe": 6, "chhah": 6, "che": 6, "saat": 7, "aath": 8, "nau": 9, "das": 10, "gyarah": 11, "barah": 12,
    "pandrah": 15, "bees": 20, "tees": 30,
}
_NUM = "(" + "|".join(_NUMBER_WORDS) + ")"
_UNIT = r"(?=\s*(?:baje|bje|am\b|pm\b|o'?clock|oclock|min|mins|minutes?|hours?|hrs?|ghante|ghanta|baad|bad)\b)"


def _spoken_numbers(text: str) -> str:
    s = text
    s = re.sub(r"\bdedh\s+(?:baje|bje)\b", "1:30 baje", s, flags=A)
    s = re.sub(r"\b(?:dhai|dhaai)\s+(?:baje|bje)\b", "2:30 baje", s, flags=A)
    s = re.sub(rf"\bsaade?\s+{_NUM}\s+(?:baje|bje)\b", lambda m: f"{_NUMBER_WORDS[m.group(1)]}:30 baje", s, flags=A)
    s = re.sub(rf"\bsawa\s+{_NUM}\s+(?:baje|bje)\b", lambda m: f"{_NUMBER_WORDS[m.group(1)]}:15 baje", s, flags=A)
    s = re.sub(rf"\bpaune\s+{_NUM}\s+(?:baje|bje)\b", lambda m: f"{((_NUMBER_WORDS[m.group(1)] or 1) - 1) or 12}:45 baje", s, flags=A)
    s = re.sub(rf"\b{_NUM}{_UNIT}", lambda m: str(_NUMBER_WORDS[m.group(1)]), s, flags=A)
    s = re.sub(r"\b(?:in|after)\s+(?:an?|one)\s+hour\b", "in 1 hours", s, flags=A)
    return s


_UNIT_SHORT_FORMS = {"mins", "min", "mnts", "mnt", "minuts", "minutess", "mints", "hrs", "hr", "hurs", "hrss"}


def fix_typos(text: str) -> str:
    source = str(text or "")

    def repair(m: re.Match) -> str:
        word = m.group(0)
        lower = word.lower()
        # "5 hrs" is a duration, but "send resume to hr" is not: a unit short form needs a number in front of it
        if lower in _UNIT_SHORT_FORMS and not re.search(r"\d\s*$", source[: m.start()]):
            return word
        if lower in _ALIASES:
            alias = _ALIASES[lower]
            return word if alias is None else alias
        return _nearest_word(lower) or word

    fixed = re.sub(r"[A-Za-z0-9']+", repair, source)
    fixed = re.sub(r"\b(\d+)\s*(?:mins?|mnts?)\b", r"\1 minutes", fixed, flags=A | re.I)
    return _spoken_numbers(fixed)


# ---------------------------------------------------------------------------------------------------
# Layer 2: category (categoryModel.js, built-in part only; the server keeps no personal memory)
# ---------------------------------------------------------------------------------------------------
_SEED = {
    "Assignment": "assignment assignments homework hw worksheet submit submission report essay notes record journal tutorial copy register printout print handwritten write writing answer sheet chapter reading read likhna jama kaam lab file observation manual",
    "Project": "project projects deploy deployment commit prototype demo presentation ppt code coding bug build github repo feature website design model dataset train merge review sprint standup client api backend frontend app release module paper-work",
    "Exam / Quiz": "exam exams quiz test viva paper midterm endsem revision revise syllabus practical study prepare preparation semester sem formula formulas pyq unit cat mst padhna padhai tayari exam-hall admit",
    "Placement / Internship": "interview placement internship resume cv oa assessment hackathon recruiter offer aptitude gd company referral linkedin apply application job dsa leetcode codeforces mock hr round naukri campus drive",
    "Extracurricular": "gym workout run running yoga club practice rehearsal match cricket football gaming guitar dance meditate meditation sports sport walk badminton swim swimming cycling music singing drawing painting event fest society nss ncc volunteer chess basketball volleyball trek jog",
    "Personal": "mom mum dad mother father bhai didi friend birthday bday call buy bill rent recharge doctor medicine pay grocery groceries shopping laundry water sleep bank pickup dinner lunch breakfast train flight ticket trip haircut salon charge wifi electricity gas vegetables sabzi dawai ghar wedding shaadi party gift movie date dentist",
}
_ALPHA = 0.05
_PREFIX_WEIGHT = 0.5
_CONFIDENT = 0.6


def _words(text: str) -> list[str]:
    low = str(text or "").lower()
    return [low[a:b] for a, b in _runs(low, "LM", 2)]


def _features(text: str) -> dict[str, float]:
    out: dict[str, float] = {}
    for w in dict.fromkeys(_words(text)):
        out[w] = 1
        if len(w) >= 5 and re.fullmatch(r"[a-z]+", w):
            out[f"~{w[:4]}"] = _PREFIX_WEIGHT
    return out


_seed_counts: dict[str, dict[str, float]] = {}
_vocab: set[str] = set()
for _cat, _lst in _SEED.items():
    _seed_counts[_cat] = {}
    for _f, _w in _features(_lst).items():
        _seed_counts[_cat][_f] = _seed_counts[_cat].get(_f, 0) + _w
        _vocab.add(_f)
_seed_totals = {c: sum(m.values()) for c, m in _seed_counts.items()}


def _score_text(text: str) -> tuple[str, float, int]:
    feats = _features(text)
    cats = list(_seed_counts)
    vocab_size = len(_vocab) + 1
    matched = 0
    logp = {c: 0.0 for c in cats}
    for f, wgt in feats.items():
        if f not in _vocab:
            continue
        matched += 1
        for c in cats:
            n = _seed_counts[c].get(f, 0)
            logp[c] += wgt * math.log((n + _ALPHA) / (_seed_totals[c] + _ALPHA * vocab_size))
    if not matched:
        return "Other", 0.0, 0
    top = max(logp.values())
    total = sum(math.exp(logp[c] - top) for c in cats)
    best = cats[0]
    for c in cats:
        if logp[c] > logp[best]:
            best = c
    return best, 1 / total, matched


def _pick_category(title: str, detail: str, rule_guess: str) -> str:
    if rule_guess and rule_guess != "Other":
        return rule_guess
    best, share, matched = _score_text(f"{title} {detail or ''}")
    return best if matched and share >= _CONFIDENT else "Other"


_CATEGORY_RULES = [
    ("Exam / Quiz", re.compile(r"\b(exam|quiz|test|viva|paper|midterm|mid-sem|endsem|end-sem|revision|revise|syllabus|practical)\b", A)),
    ("Placement / Internship", re.compile(r"\b(interview|placement|internship|resume|cv|oa|assessment|hackathon|recruiter|offer letter|aptitude|gd)\b", A)),
    ("Assignment", re.compile(r"\b(assignment|homework|hw|lab file|record|worksheet|submit|submission|report|essay|notes)\b", A)),
    ("Project", re.compile(r"\b(project|deploy|deployment|commit|prototype|demo|presentation|ppt|code|coding|bug|build)\b", A)),
    ("Extracurricular", re.compile(r"\b(gym|workout|run|running|yoga|club|practice|rehearsal|match|cricket|football|gaming|guitar|dance|meditat\w*|sports?|walk)\b", A)),
    ("Personal", re.compile(r"\b(mom|mum|dad|mother|father|bhai|didi|friend|birthday|bday|call|buy|bill|rent|recharge|doctor|medicine|pay|grocer\w*|shopping|laundry|water|sleep|bank|pick up|dinner|lunch|breakfast|train|flight|ticket|trip)\b", A)),
]


def _guess_category(lower: str) -> str:
    for category, rx in _CATEGORY_RULES:
        if rx.search(lower):
            return category
    return "Other"


# ---------------------------------------------------------------------------------------------------
# IST helpers on epoch milliseconds (same numbers the JS parser works with)
# ---------------------------------------------------------------------------------------------------
_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def _ist_parts(ms: int) -> dict[str, int]:
    d = _EPOCH + timedelta(milliseconds=ms + IST_OFFSET_MS)
    return {"y": d.year, "mo": d.month - 1, "d": d.day, "h": d.hour, "mi": d.minute, "weekday": d.weekday()}


def _from_ist(y: int, mo: int, d: int, h: int = 0, mi: int = 0) -> int:
    """IST wall clock -> epoch ms. Month and day overflow roll over, like JavaScript's Date.UTC."""
    y += mo // 12
    mo %= 12
    base = datetime(y, mo + 1, 1) + timedelta(days=d - 1, hours=h, minutes=mi)
    return int((base - datetime(1970, 1, 1)).total_seconds()) * 1000 - IST_OFFSET_MS


def _floor_minute(ms: int) -> int:
    return (ms // MIN) * MIN


def _day_start(ms: int) -> int:
    p = _ist_parts(ms)
    return _from_ist(p["y"], p["mo"], p["d"])


# ---------------------------------------------------------------------------------------------------
# Vocabulary
# ---------------------------------------------------------------------------------------------------
_WEEKDAY_WORDS = {
    "mon": 0, "monday": 0, "somvar": 0, "somwar": 0,
    "tue": 1, "tues": 1, "tuesday": 1, "mangalvar": 1, "mangalwar": 1,
    "wed": 2, "weds": 2, "wednesday": 2, "budhvar": 2, "budhwar": 2,
    "thu": 3, "thur": 3, "thurs": 3, "thursday": 3, "guruvar": 3, "guruwar": 3, "brihaspativar": 3, "veervar": 3,
    "fri": 4, "friday": 4, "shukravar": 4, "shukrawar": 4,
    "sat": 5, "saturday": 5, "shanivar": 5, "shaniwar": 5,
    "sun": 6, "sunday": 6, "ravivar": 6, "raviwar": 6, "itwar": 6,
}
_DAY_NAME = "(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:s|nesday)?|thu(?:rs?(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|somvar|somwar|mangalvar|mangalwar|budhvar|budhwar|guruvar|guruwar|brihaspativar|veervar|shukravar|shukrawar|shanivar|shaniwar|ravivar|raviwar|itwar)"
_MONTHS = {
    "jan": 0, "january": 0, "feb": 1, "february": 1, "mar": 2, "march": 2, "apr": 3, "april": 3, "may": 4, "jun": 5, "june": 5,
    "jul": 6, "july": 6, "aug": 7, "august": 7, "sep": 8, "sept": 8, "september": 8, "oct": 9, "october": 9, "nov": 10, "november": 10, "dec": 11, "december": 11,
}
_MONTH_NAME = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
_PARTS = {
    "morning": ((9, 0), "(?:morning|subah|subha|savere)"),
    "afternoon": ((14, 0), "(?:afternoon|dopahar|dophar)"),
    "evening": ((18, 0), "(?:evening|sham|shaam)"),
    "night": ((21, 0), "(?:night|raat|tonight)"),
}
_PART_ANY = "(?:morning|subah|subha|savere|afternoon|dopahar|dophar|evening|sham|shaam|night|raat|tonight)"


def _part_key(word: str) -> str | None:
    for k, (_, pat) in _PARTS.items():
        if re.fullmatch(pat, word, A):
            return k
    return None


class _State:
    def __init__(self, text: str) -> None:
        self.text = text


def _take(state: _State, pattern: str) -> re.Match | None:
    m = re.search(pattern, state.text, A)
    if not m:
        return None
    state.text = f"{state.text[:m.start()]} {state.text[m.end():]}"
    return m


def _pick_weekdays(chunk: str) -> list[int]:
    out = set()
    for m in re.finditer(rf"\b{_DAY_NAME}\b", chunk, A):
        w = m.group(0)
        n = _WEEKDAY_WORDS.get(w, _WEEKDAY_WORDS.get(w[:3]))
        if n is not None:
            out.add(n)
    return sorted(out)


def _to24(hour12: int, meridiem: str) -> int:
    return (hour12 % 12) + 12 if meridiem[:1].lower() == "p" else hour12 % 12


def _guess_hour(h: int, minute: int, part: str | None, now_ms: int, bias: str | None = None, future_day: bool = False) -> int:
    if h >= 13:
        return h
    if part == "morning":
        return 12 if h == 12 else h
    if part == "afternoon":
        return 12 if h == 12 else h + 12
    if part == "evening":
        return 0 if h == 12 else h + 12
    if part == "night":
        return 0 if h == 12 else (h + 12 if h >= 6 else h)
    if h == 12:
        return 12
    if bias == "am":
        return h
    if bias == "pm":
        return h + 12
    if 1 <= h <= 6:
        return h + 12
    if future_day:
        return h
    now = _ist_parts(now_ms)
    now_min = now["h"] * 60 + now["mi"]
    if now_min < h * 60 + minute:
        return h
    if now_min < (h + 12) * 60 + minute:
        return h + 12
    return h


def _named_date(now_p: dict, day: int, month: int | None, year_text: str | None) -> int | None:
    if month is None or day < 1 or day > 31:
        return None

    def make(year: int) -> int | None:
        if not 1 <= year <= 9999:
            return None
        try:
            ms = _from_ist(year, month, day)
        except (OverflowError, ValueError):
            return None
        return ms if _ist_parts(ms)["d"] == day else None

    if year_text:
        return make(int(year_text))
    today = _from_ist(now_p["y"], now_p["mo"], now_p["d"])
    for year in range(now_p["y"], now_p["y"] + 9):
        ms = make(year)
        if ms is not None and ms >= today:
            return ms
    return None


def _next_day_of_month(now_p: dict, day: int) -> int | None:
    if day < 1 or day > 31:
        return None
    today = _from_ist(now_p["y"], now_p["mo"], now_p["d"])
    for i in range(14):
        year = now_p["y"] + (now_p["mo"] + i) // 12
        month = (now_p["mo"] + i) % 12
        ms = _from_ist(year, month, day)
        if _ist_parts(ms)["d"] == day and ms >= today:
            return ms
    return None


def _default_from_now(now: int, said_today: bool = False) -> int:
    """About 2 hours ahead on the next hour or half hour; before 7 am it waits for 9 am, from 10 pm on for 9 am tomorrow
    (or, when the person said "today", about 10 minutes on a 5-minute mark)."""
    slot = -(-(now + DEFAULT_LEAD_MS) // SLOT_MS) * SLOT_MS
    same_day = _day_start(slot) == _day_start(now)
    hour = _ist_parts(slot)["h"]
    if same_day and EARLIEST_DEFAULT_HOUR <= hour < LATEST_DEFAULT_HOUR:
        return slot
    if same_day and hour < EARLIEST_DEFAULT_HOUR:
        return _day_start(now) + 9 * HOUR
    if said_today:
        soon = -(-(now + 10 * MIN) // (5 * MIN)) * (5 * MIN)
        return soon if _day_start(soon) == _day_start(now) else now + 10 * MIN
    return _day_start(now) + DAY + 9 * HOUR


def _moment_key(m: re.Match) -> str:
    if m.group(4):
        return "end of day"
    if m.group(3):
        return "before bed"
    what = "bed" if re.match(r"bed|sleep", m.group(2)) else "dinner" if m.group(2) == "supper" else m.group(2)
    return f"{m.group(1)} {what}"


# ---------------------------------------------------------------------------------------------------
# Title / description
# ---------------------------------------------------------------------------------------------------
TITLE_MAX_WORDS = 9
TITLE_MAX_CHARS = 60

# Lead-in words that say "remember this" but are not the thing to remember (see quickParse.js).
_LEAD_PATTERNS = [re.compile(x, A) for x in (
    r"^(?:please|plz|pls|kindly|hey|hi|ok|okay|so|also|then|really|just|actually)\s+",
    r"^(?:can|could|would|will)\s+you\s+(?:please\s+)?",
    r"^(?:remind\s+me|reminder|set\s+(?:a\s+)?reminder|add\s+(?:a\s+)?reminder|mujhe\s+yaad\s+dilao|yaad\s+dilana|add)\s*(?:to|about|for|that|ki|ko|:)?\s*",
    r"^(?:i|we)(?:'ll|\s+will)\s+",
    r"^(?:let\s+me|lemme)\s+",
    r"^(?:i|we|mujhe|mereko|hume|humein)\s+(?:(?:really|just|also)\s+)?(?:need|must|should|gotta|wanna)(?:\s+(?:really|just|actually|also))?(?:\s+to)?\s+",
    r"^(?:i|we)\s+(?:have|got|has)\s+(?:an?|the)\s+",
    r"^(?:i|we|mujhe|mereko|hume|humein)\s+(?:(?:really|just|also)\s+)?(?:have|has|got|want|ought)\s+to\s+",
    r"^(?:mujhe|mereko|hume|humein)\s+",
    r"^(?:need|have|has|got|want)\s+to\s+",
    r"^(?:gotta|must|should|wanna|supposed\s+to)\s+",
    r"^(?:(?:please\s+)?(?:don'?t|do\s+not|never)\s+forget|remember|yaad\s+se|yaad\s+rakhna|yaad\s+rakho|bhoolna\s+mat|make\s+sure)(?:\s+(?:to|that|ki|i|you))?\s+",
)]
_TRAIL_PATTERNS = [re.compile(x, A) for x in (
    r"\s+(?:(?:please|plz|pls)\s+)?(?:remind\s+me|reminder)$",
    r"\s+(?:please|plz|pls|thanks|thank\s+you|ok|okay)$",
    r"\s+(?:hai|hain|hoga|hogi|tha|thi)$",
    r"\s+(?:yaad\s+se|yaad\s+rakhna|bhoolna\s+mat)$",
)]
# A word like "on" / "by" / "before" left standing right before the place where a date or time was taken out
_DANGLING = re.compile(r"\b(?:on|at|by|before|till|until|due|from|around)\s{2,}", A)
_FILLER_EDGES = re.compile(
    r"^(?:to|about|for|that|ki|ko|ke liye|at|on|by|in|the|a|and|aur|se|tak|par|pe|per|me|mein)\s+|\s+(?:to|about|for|that|ki|ko|ke liye|at|on|by|in|and|aur|se|tak|par|pe|per|me|mein|from|due|before|till|until|deadline)$",
    A,
)
_TRAILING_STOPWORDS = re.compile(r"\s+(?:to|the|a|an|of|for|and|with|in|on|at|by|from|my|your|our|that|this|every|each|all|any|some|aur|ko|ki|ka|ke|se|me|mein)$", A)
_CLAUSE_BREAK = re.compile(r",|\s(?:because|so that|since|as|but|which|while|kyunki|kyuki|taaki|jab|aur|and)\s", A)


def _words_in(t: str) -> int:
    return len([w for w in re.split(r"\s+", t) if w])


def _tidy(t: str) -> str:
    t = re.sub(r"\s+", " ", t)
    t = re.sub(r"\s+,", ",", t)
    t = re.sub(r"(?:,\s*){2,}", ", ", t)
    t = re.sub(r"^[\s.,:;\-–—]+|[\s.,:;\-–—]+$", "", t)
    return t.strip()


def _build_title(text: str, original: str) -> str:
    """The title from the sentence with its date, time and repeat words already taken out (lower case)."""
    t = _DANGLING.sub(" ", text)
    t = re.sub(r"\s*[:;|]\s*", ", ", t)
    t = re.sub(r"\s[-–—]\s", ", ", t)
    t = re.sub(r"\s*[()]\s*", ", ", t)
    t = _tidy(t)
    for _ in range(6):
        before = t
        for rx in _LEAD_PATTERNS:
            t = rx.sub("", t, count=1).strip()
        for rx in _TRAIL_PATTERNS:
            t = rx.sub("", t, count=1).strip()
        t = _tidy(_FILLER_EDGES.sub("", t, count=1))
        if t == before:
            break
    if not t:
        return "Reminder"
    if _words_in(t) > 6:
        t = re.sub(r"\b(?:my|our)\s+", "", t, flags=A)
    t = _cap_title(t)
    t = _restore_case(t, original)
    return _cap(t)[:200]


def _cap_title(t: str) -> str:
    """A long sentence is cut where one thought ends; with no such place, at the last whole word that fits."""
    if _words_in(t) <= TITLE_MAX_WORDS and len(t) <= TITLE_MAX_CHARS:
        return t
    for m in _CLAUSE_BREAK.finditer(t):
        left = _tidy(t[: m.start()])
        if 3 <= _words_in(left) <= TITLE_MAX_WORDS and len(left) <= TITLE_MAX_CHARS:
            return left
    out: list[str] = []
    for w in t.split(" "):
        if len(out) >= TITLE_MAX_WORDS or len(" ".join([*out, w])) > TITLE_MAX_CHARS:
            break
        out.append(w)
    cut = _tidy(" ".join(out))
    for _ in range(3):
        cut = _tidy(_TRAILING_STOPWORDS.sub("", cut, count=1))
    return cut


def _restore_case(text: str, original: str) -> str:
    mapping: dict[str, str] = {}
    for w in original.split(" "):
        a, b = 0, len(w)
        while a < b and not _is(w[a], "LN"):
            a += 1
        while b > a and not _is(w[b - 1], "LN"):
            b -= 1
        core = w[a:b]
        if core and core != core.lower() and core.lower() not in mapping:
            mapping[core.lower()] = core
    if not mapping:
        return text
    out, i = [], 0
    for a, b in _runs(text, "LN"):
        out.append(text[i:a])
        word = text[a:b]
        out.append(mapping.get(word.lower(), word))
        i = b
    out.append(text[i:])
    return "".join(out)


def _cap(s: str) -> str:
    return s[:1].upper() + s[1:]


# ---------------------------------------------------------------------------------------------------
# The parser
# ---------------------------------------------------------------------------------------------------
def parse_quick(text: str, now_ms: int) -> dict[str, Any] | None:
    """Same result shape as the JS parser: {payload, confidence, found, assumedTime}. ``payload['due_date']`` is
    epoch milliseconds here (the caller turns it into a datetime); None for an empty sentence."""
    original = fix_typos(normalize_local(re.sub(r"\s+", " ", str(text or "")).strip()))
    if not original:
        return None
    now = _floor_minute(now_ms)
    now_p = _ist_parts(now)
    state = _State(" " + original.lower().replace("“", '"').replace("”", '"') + " ")
    found: list[str] = []

    # 1. relative
    relative_ms: int | None = None
    relative_in_days = False
    m = _take(state, r"\b(?:in|after)\s+(\d+(?:\.\d+)?|an?|half an?)\s*(min(?:ute)?s?|hours?|hrs?|h|days?)\b") or _take(
        state, r"\b(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|ghant[ea]|hours?|hrs?)\s*(?:baad|bad|mein|me)\b"
    )
    if m:
        raw = m.group(1)
        n = 0.5 if raw.startswith("half") else 1.0 if re.fullmatch(r"an?", raw) else float(raw)
        unit = MIN if m.group(2)[0] == "m" else DAY if m.group(2)[0] == "d" else HOUR
        if 0 < n <= 1000:
            relative_ms = now + math.floor(n * unit + 0.5)
            relative_in_days = unit == DAY
            found.append("relative")

    # 2. repeats
    schedule = "once"
    weekdays: list[int] = []
    part_from_repeat: str | None = None
    if relative_ms is None:
        m = _take(state, rf"\b(?:every|each|har)\s+((?:{_DAY_NAME}\b[\s,&]*(?:and\b|aur\b)?[\s,&]*)+)")
        if m:
            schedule = "weekly"
            weekdays = _pick_weekdays(m.group(1)) or [now_p["weekday"]]
        if schedule == "once" and _take(state, r"\b(?:every\s*weekdays?|weekdays|monday to friday|mon-fri)\b"):
            schedule, weekdays = "weekly", [0, 1, 2, 3, 4]
        elif schedule == "once" and _take(state, r"\b(?:every\s*weekends?|weekends)\b"):
            schedule, weekdays = "weekly", [5, 6]
        if schedule == "once":
            m = _take(state, rf"\bevery\s+({_PART_ANY})\b")
            if m:
                schedule = "daily"
                part_from_repeat = _part_key(m.group(1))
        if schedule == "once" and _take(state, r"\b(?:every\s*day|everyday|daily|each day|roz(?:ana)?|har\s*din|hr\s*din)\b"):
            schedule = "daily"
        if schedule == "once" and _take(state, r"\b(?:every\s*week|weekly|each week|har\s*hafte|har\s*week)\b"):
            schedule, weekdays = "weekly", [now_p["weekday"]]
        if schedule != "once":
            found.append("repeat")

    # 3. date
    day_ms: int | None = None
    bare_past = False
    if schedule == "once" and relative_ms is None:
        state.text = re.sub(rf"\b\d{{1,2}}\s*[-–]\s*(\d{{1,2}})\s+({_MONTH_NAME})\b", r"\1 \2", state.text, count=1, flags=A)
        if _take(state, r"\b(?:day after tomorrow|parso|parson|overmorrow)\b"):
            day_ms = _day_start(now) + 2 * DAY
        elif _take(state, r"\b(?:tomorrow|tmrw|tmr|tomorow|tommorow)(?:'?s)?\b|\bkal\b"):
            day_ms = _day_start(now) + DAY
        elif _take(state, r"\b(?:today(?:'?s)?|aaj|tonight(?:'?s)?)\b"):
            day_ms = _day_start(now)
        elif _take(state, r"\bnext week\b"):
            day_ms = _day_start(now) + 7 * DAY
        elif (m := _take(state, rf"\b(?:(next|this|coming|agle)\s+)?(?:on\s+)?({_DAY_NAME})\b")):
            target = _WEEKDAY_WORDS[m.group(2)]
            ahead = (target - now_p["weekday"]) % 7
            if m.group(1) in ("next", "agle"):
                ahead = 7 if ahead == 0 else ahead
            day_ms = _day_start(now) + ahead * DAY
            bare_past = ahead == 0
        elif (m := _take(state, rf"\b(?:on\s+)?(\d{{1,2}})(?:st|nd|rd|th)?\s*(?:of\s+)?({_MONTH_NAME})\b(?:\s*,?\s*(\d{{4}}))?")):
            day_ms = _named_date(now_p, int(m.group(1)), _MONTHS.get(m.group(2)), m.group(3))
        elif (m := _take(state, rf"\b({_MONTH_NAME})\s+(\d{{1,2}})(?:st|nd|rd|th)?\b(?:\s*,?\s*(\d{{4}}))?")):
            day_ms = _named_date(now_p, int(m.group(2)), _MONTHS.get(m.group(1)), m.group(3))
        elif (m := _take(state, r"\b(?:by|on|before|till|until)?\s*(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b(?!\s*(?:of\s+)?(?:every|each))")):
            day_ms = _next_day_of_month(now_p, int(m.group(1)))
        elif (m := _take(state, r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b")):
            month = int(m.group(2)) - 1
            if 0 <= month <= 11:
                day_ms = _named_date(now_p, int(m.group(3)), month, m.group(1))
        elif (m := _take(state, r"\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b")):
            day, month = int(m.group(1)), int(m.group(2)) - 1
            if 1 <= day <= 31 and 0 <= month <= 11:
                yr = m.group(3)
                day_ms = _named_date(now_p, day, month, (f"20{yr}" if len(yr) == 2 else yr) if yr else None)
        if day_ms is not None:
            found.append("date")

    # 4. time of day
    clock: tuple[int, int] | None = None
    part_key = part_from_repeat
    clock_from_part = False
    lower_original = original.lower()
    am_hit = bool(re.search(_AM_WORDS, lower_original, A))
    pm_hit = bool(re.search(_PM_WORDS, lower_original, A))
    bias = ("am" if am_hit else "pm") if am_hit != pm_hit else None
    # "tomorrow at 9" and "every day at 10" are mornings; "the next time it happens" is only for a one-time reminder today
    future_day = schedule != "once" or (day_ms is not None and day_ms > _day_start(now))

    def guess(h: int, minute: int) -> int:
        return _guess_hour(0 if h == 24 else h, minute, part_key, now, bias, future_day)

    if re.search(r"\btonight\b", original, A | re.I):
        part_key = "night"
    part_match = re.search(rf"\b({_PART_ANY})\b", state.text, A)
    if part_match and not part_key:
        part_key = _part_key(part_match.group(1))

    moment = _take(state, _MOMENT_RE)

    m = _take(state, r"\b(half\s+past|quarter\s+past|quarter\s+to)\s+(\d{1,2})(?:\s*(a\.?m\.?|p\.?m\.?))?(?=\W|$)")
    if m:
        h = int(m.group(2))
        if 1 <= h <= 12:
            to = m.group(1).endswith("to")
            hh = (12 if h == 1 else h - 1) if to else h
            minute = 30 if m.group(1).startswith("half") else 45 if to else 15
            clock = (_to24(hh, m.group(3)) if m.group(3) else guess(hh, minute), minute)
    if not clock and (m := _take(state, r"\b(?:at\s+|@\s*)?(\d{1,2})(?:[:.\s](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?=\W|$)")):
        h, mi = int(m.group(1)), int(m.group(2) or 0)
        if 1 <= h <= 12 and mi <= 59:
            clock = (_to24(h, m.group(3)), mi)
    if not clock and (m := _take(state, r"\b(?:at\s+|@\s*)?([01]?\d|2[0-3]):([0-5]\d)\b")):
        h, mi = int(m.group(1)), int(m.group(2))
        clock = (h, mi) if h >= 13 or len(m.group(1)) == 2 or h == 0 else (guess(h, mi), mi)
    if not clock and (m := _take(state, r"\b(?:at\s+|@\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(?:baje|bje|o'?clock|oclock|am|pm)\b")):
        h, mi = int(m.group(1)), int(m.group(2) or 0)
        if 0 <= h <= 24 and mi <= 59:
            clock = (guess(h, mi), mi)
    if not clock and (m := _take(state, r"\bat\s+(\d{1,2})(?:[:.](\d{2}))?(?!\d)(?!\s*(?:min|hour|hr|day|week|%))")):
        h, mi = int(m.group(1)), int(m.group(2) or 0)
        if 0 <= h <= 24 and mi <= 59:
            clock = (guess(h, mi), mi)
    if not clock and _take(state, r"\b(?:noon|midday|dopahar ko)\b"):
        clock = (12, 0)
    if not clock and _take(state, r"\b(?:midnight|aadhi raat)\b"):
        clock = (0, 0)
    if not clock and moment:
        clock = _MOMENTS.get(_moment_key(moment))
    if clock:
        found.append("time")
    if part_match:
        state.text = re.sub(rf"\b{_PART_ANY}\b", " ", state.text, count=1, flags=A)
    if not clock and part_key:
        clock = _PARTS[part_key][0]
        clock_from_part = True
        found.append("part")

    # 5. title (the title is all there is: no description) and category
    title = _build_title(state.text, original)
    category = _pick_category(title, "", _guess_category(lower_original))

    def usual_clock() -> tuple[int, int] | None:
        for rx, at in _KEYWORD_CLOCKS:
            if re.search(rx, lower_original, A):
                return at
        return None

    # 6. resolve the due date / time_of_day
    payload: dict[str, Any] = {"schedule_type": schedule, "description": None}
    if schedule == "once":
        if relative_ms is not None:
            due = _day_start(relative_ms) + (clock[0] * 60 + clock[1]) * MIN if relative_in_days and clock else relative_ms
        elif day_ms is None and not clock:
            due = _default_from_now(now)
        elif day_ms is None:
            due = _from_ist(now_p["y"], now_p["mo"], now_p["d"], clock[0], clock[1])
            if due <= now:
                due += DAY
        elif not clock:
            at = usual_clock() or DEFAULT_TIME_ON_FUTURE_DAY
            due = _default_from_now(now, True) if day_ms == _day_start(now) else day_ms + (at[0] * 60 + at[1]) * MIN
        else:
            due = day_ms + (clock[0] * 60 + clock[1]) * MIN
            if clock_from_part and due <= now and day_ms == _day_start(now):
                due = _default_from_now(now, True)
            if part_key == "night" and not clock_from_part and clock[0] < 6 and due <= now and day_ms == _day_start(now):
                due += DAY
            if bare_past and due <= now:
                due += 7 * DAY
        payload["due_date"] = due
    else:
        h, mi = clock or usual_clock() or (9, 0)
        payload["time_of_day"] = f"{h:02d}:{mi:02d}"
        if schedule == "weekly":
            payload["weekdays"] = weekdays

    payload["title"] = title
    payload["category"] = category

    word_count = len(original.split(" "))
    confidence = "high" if found or word_count <= 3 else "low"
    assumed_time = schedule == "once" and "relative" not in found and not clock
    return {"payload": payload, "confidence": confidence, "found": found, "assumedTime": assumed_time}
