#!/usr/bin/env bash
set -euo pipefail

# Full pinned user-owned HELP toolkit with no copied credentials or databases.
SOURCE_URL="https://github.com/johnstacey16-ui/HELP-Clan-PUBG-Toolkit.git"
SOURCE_SHA="a836606c896069b342fe9a1dbf3fb05934284342"
ROOT="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone --depth=1 "$SOURCE_URL" "$TMP/help"
if [[ "$(git -C "$TMP/help" rev-parse HEAD)" != "$SOURCE_SHA" ]]; then
  git -C "$TMP/help" fetch --depth=1 origin "$SOURCE_SHA"
  git -C "$TMP/help" checkout --detach "$SOURCE_SHA"
fi
test "$(git -C "$TMP/help" rev-parse HEAD)" = "$SOURCE_SHA"

# The publisher's untouched site must pass its own strict tests first.
# Those assertions inspect exact original HTML, art paths and workflow files;
# moving those checks to the namespaced copy would create false failures.
(
  cd "$TMP/help"
  node scripts/build-static.cjs --check
  node --test tests/*.test.cjs
  node tests/browser-smoke.cjs
  node tests/hit-zone-preview-smoke.cjs
  node tests/visual-layout-smoke.cjs
)

mkdir -p "$ROOT/training"
rsync -a --delete --exclude='.git' --exclude='.github' "$TMP/help/" "$ROOT/training/"

node - "$ROOT/training/index.html" <<'JS'
const fs=require('node:fs');
const file=process.argv[2];
let html=fs.readFileSync(file,'utf8');
if(!html.includes('<head>')||!html.includes('<body>'))
  throw Error('Unexpected HELP toolkit HTML');
html=html.replaceAll('/assets/damage-training-mannequin.svg',
 '/training/assets/damage-training-mannequin.svg');
html=html.replace('<head>',
 '<head>\n<link rel="stylesheet" href="command-centre-bridge.css">');
html=html.replace('<body>',
 '<body>\n'+
 '<nav class="command-centre-bridge" aria-label="PUBG Command Centre cross navigation">\n'+
 '  <a href="/" aria-label="Return to PUBG player statistics">← Player statistics</a>\n'+
 '  <strong>PUBG COMMAND CENTRE <span>/ TRAINING</span></strong>\n'+
 '  <a href="/#matches">Matches &amp; replays →</a>\n'+
 '</nav>');
fs.writeFileSync(file,html);
JS

cat > "$ROOT/training/command-centre-bridge.css" <<'CSS'
/* Navigation bridge only; HELP calculators and visual designs are preserved. */
.command-centre-bridge{display:flex;align-items:center;justify-content:space-between;
 gap:14px;padding:10px clamp(14px,3vw,36px);background:#0e1d32;color:#eef7ff;
 border-bottom:1px solid #2e5064;font:600 13px/1.4 system-ui,Arial,sans-serif}
.command-centre-bridge a{color:#6ff7da;text-decoration:none;border:1px solid #35677a;
 border-radius:9px;padding:9px 12px;white-space:nowrap}
.command-centre-bridge a:hover,.command-centre-bridge a:focus-visible{
 background:#153c4d;color:#fff;outline-offset:2px}
.command-centre-bridge strong{letter-spacing:.085em;text-align:center}
.command-centre-bridge strong span{color:#9eb3c9;font-weight:500}
@media(max-width:540px){
 .command-centre-bridge{gap:7px;flex-wrap:wrap;justify-content:center}
 .command-centre-bridge strong{order:-1;flex:1 1 100%;font-size:12px}
 .command-centre-bridge a{font-size:12px;flex:1;text-align:center}
}
CSS

cat > "$ROOT/training/SOURCE.md" <<'SOURCE'
# Integrated HELP Clan training toolkit

Static namespaced snapshot of the user-owned, public HELP toolkit:
https://github.com/johnstacey16-ui/HELP-Clan-PUBG-Toolkit

Pinned source commit: a836606c896069b342fe9a1dbf3fb05934284342
Source date: 28 October 2026
Refresh: bash scripts/vendor-help-toolkit.sh

All original training calculators, source sections, docs, original tests,
and publisher art credits remain intact. The HTML only gains cross-site
navigation and a namespaced absolute mannequin asset path. New, isolated
CSS styles only the navigation bridge. The original source is preserved.

No player history, Discord tokens, Supabase keys or private data copied.
Creator-developed sensitivity and empirical recoil/TTK models remain
distinguishable from official published PUBG measurements: consult
DATA_ACCURACY_POLICY.md and VISUAL_ARTWORK_CREDITS.md.
SOURCE

node "$ROOT/scripts/check-training-integration.cjs"
echo "Pinned HELP toolkit copied to /training/."
