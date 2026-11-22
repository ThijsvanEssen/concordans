#!/usr/bin/env bash
# Bouwt static/fonts/ uit fonts/bron/: de variabele assen beperkt tot het gebruikte bereik
# (fonttools varLib.instancer) en de latin-ext op de tekens die echte bronnen vroegen
# (pyftsubset). Herhaalbaar: dezelfde bron en dezelfde fonttools geven dezelfde bytes.
# Gebruik: npm run fonts
set -euo pipefail
# Vaste tijdstempel in de fonts, zodat dezelfde bron dezelfde bytes geeft.
export SOURCE_DATE_EPOCH=1767225600
cd "$(dirname "$0")/.."

VENV="${LGE_FONTS_VENV:-${TMPDIR:-/tmp}/lge-fonts-venv}"
if [ ! -x "$VENV/bin/fonttools" ]; then
	python3 -m venv "$VENV"
	"$VENV/bin/pip" -q install fonttools==4.62.1 brotli==1.2.0
fi
FT="$VENV/bin/fonttools"
SUB="$VENV/bin/pyftsubset"
BRON=fonts/bron
UIT=static/fonts
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Gewicht 400 tot 600 is wat fonts.css aankondigt; buiten dat bereik klemde de browser al.
# Optische grootte 8 tot 36: de teksten staan op 10 tot 30 px (tokens.css, --t-*).
instantiate() { # bron, uit, assen...
	local bron="$1" uit="$2"
	shift 2
	"$FT" varLib.instancer "$BRON/$bron.woff2" "$@" -o "$uit" >/dev/null
}

instantiate Newsreader-Variable "$UIT/Newsreader-Variable.woff2" wght=400:600 opsz=8:36
instantiate Newsreader-VariableItalic "$UIT/Newsreader-VariableItalic.woff2" wght=400:600 opsz=8:36
instantiate SchibstedGrotesk-Variable "$UIT/SchibstedGrotesk-Variable.woff2" wght=400:600
instantiate SchibstedGrotesk-Variable-latin-ext "$UIT/SchibstedGrotesk-Variable-latin-ext.woff2" wght=400:600

# latin-ext: Latin Extended-A, ƒ, Ș/ț, de modificatortekens, de combinerende accenten,
# Vietnamees en Welsh (U+1E80 tot 1E85, 1EF2 tot 1EF9), ß-hoofdletter en de munttekens.
# Het cijfer- en leesteken-aanbod van de latin zit al in het latin-bestand.
EXT="U+0020,U+00A0,U+0100-017F,U+0192,U+0218-021B,U+02B9,U+02BA,U+02BC,U+02C7,U+02DD,U+0300,U+0301,U+0303,U+0304,U+0308,U+0309,U+0323,U+1E80-1E85,U+1E9E,U+1EF2-1EF9,U+2020,U+20A1,U+20A3,U+20A4,U+20A6,U+20A7,U+20A9,U+20AB,U+20AD,U+20B1,U+20B2,U+20B5,U+20B9,U+20BA,U+20BC,U+20BD"
for n in Newsreader-Variable-latin-ext Newsreader-VariableItalic-latin-ext; do
	instantiate "$n" "$TMP/$n.woff2" wght=400:600 opsz=8:36
	"$SUB" "$TMP/$n.woff2" --unicodes="$EXT" --layout-features='*' --name-IDs='*' \
		--notdef-outline --flavor=woff2 --output-file="$UIT/$n.woff2"
done

ls -l "$UIT"/*.woff2 | awk '{ print $5, $9 }'
