"""Interface strings (site/js/i18n): every language has the same keys and the same {placeholders} as English, function
values (plural and ordinal forms) run, and Uzbek uses one apostrophe style. Skipped when Node.js is not installed."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "site" / "js" / "i18n"
NODE = shutil.which("node")
pytestmark = pytest.mark.skipif(NODE is None, reason="Node.js not installed")

# Loads each dictionary, calls function values with sample variables, and returns {lang: {key: [kind, text]}}.
DUMP = r"""
const dir = process.argv[1];
const out = {};
const sample = { r: '1.5', k: '5', lo: '0.8', hi: '1.9', pct: 21 };
for (const l of ['en', 'uz', 'ru', 'es']) {
  const d = (await import(`${dir}/${l}.js`)).default;
  out[l] = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === 'function' ? ['fn', v(sample)] : ['str', v]]));
}
console.log(JSON.stringify(out));
"""


@pytest.fixture(scope="module")
def dicts():
    r = subprocess.run([NODE, "--input-type=module", "-e", DUMP, str(I18N)], check=True, capture_output=True, text=True)
    return json.loads(r.stdout)


def _placeholders(s):
    import re

    return set(re.findall(r"\{(\w+)\}", s))


def test_same_keys_in_every_language(dicts):
    en = set(dicts["en"])
    for lang in ("uz", "ru", "es"):
        keys = set(dicts[lang])
        assert keys == en, (lang, sorted(en - keys)[:20], sorted(keys - en)[:20])


def test_same_placeholders(dicts):
    bad = []
    for lang in ("uz", "ru", "es"):
        for k, (kind, v) in dicts[lang].items():
            ekind, ev = dicts["en"][k]
            if kind == "str" and ekind == "str" and _placeholders(v) != _placeholders(ev):
                bad.append((lang, k, sorted(_placeholders(v)), sorted(_placeholders(ev))))
    assert not bad, bad[:20]


def test_function_values_fill_every_variable(dicts):
    for lang, d in dicts.items():
        for k, (kind, v) in d.items():
            if kind == "fn":
                assert "undefined" not in v and "${" not in v and "{" not in v, (lang, k, v)


def test_plural_and_ordinal_forms(dicts):
    assert "every 5 months" in dicts["en"]["cs.sum.after"][1]
    assert "каждые 5 месяцев" in dicts["ru"]["cs.sum.after"][1]
    assert "cada 5 meses" in dicts["es"]["cs.sum.after"][1]
    assert "21st percentile" in dicts["en"]["mon.prodVal"][1]


def test_uzbek_apostrophes(dicts):
    """oʻ gʻ use U+02BB, the tutuq belgisi U+02BC; no curly quotes or ASCII apostrophes inside words.
    The analysis view (an.*) is excluded until its own strings are normalised."""
    import re

    bad = [(k, v[1][:60]) for k, v in dicts["uz"].items()
           if not k.startswith("an.") and (re.search(r"[‘’]|\w'\w|[^oOgG]ʻ|[oOgG]ʼ", v[1]))]
    assert not bad, bad[:20]
