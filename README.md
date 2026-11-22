# Attack Log

A one-tap migraine logger that writes to a Google Sheet you own.

The thing it is designed around: at 2am, mid-attack, you should have to do
exactly one thing — say that it started. Everything else gets asked later,
when you are capable of answering it honestly.

## How it fits together

Three pieces, and they have to stay in step:

| Piece | Where it lives | What it does |
|---|---|---|
| `index.html` | hosted anywhere, or opened from disk | the app; one self-contained file, no build, no dependencies |
| `apps-script/Code.gs` | bound to the `attack_log` spreadsheet | receives posted rows, builds the sheets |
| the `attack_log` Sheet | your Google Drive | the actual record |

The app posts events; the Sheet stores them; the app reads them back on
start-up, so the phone and the PC show the same history. No data lives in
this repo and none ever should.

## Setting it up from scratch

1. **Make a spreadsheet** called `attack_log` in Drive.
2. **Extensions → Apps Script.** Paste in `apps-script/Code.gs`.
3. **Change `TOKEN`** at the top to something long and random.
4. **Project Settings → time zone → Europe/London.** Apps Script defaults to
   US Pacific, and if it is wrong every Date and Time column is eight hours
   out. With 2am attacks that wrecks the whole pattern.
5. **Pick `setup` from the function dropdown and Run.** Not `doPost` — that
   is first in the file and the dropdown defaults to it. Authorise when asked
   (it will call itself unverified; it is your own script).
6. **Deploy → New deployment → Web app**, execute as **Me**, access
   **Anyone**. Copy the URL ending `/exec`, not `/dev`.
7. **Open the app → Settings**, paste the URL and token, **Test it**.

"Anyone" sounds worse than it is: it means anyone holding the URL *and* the
token can append rows. It does not make the spreadsheet readable. The token
is the actual guard, which is why it needs to be long.

## Hosting

The file is static and holds no secrets — the URL and token live in each
device's browser storage, never in the HTML. So a public GitHub Pages site
is fine.

Settings → Pages → deploy from `main`, root. The page is then at
`https://<user>.github.io/<repo>/`, and Chrome's *Add to Home Screen* gives
you an icon. Each device needs the URL and token entered once.

Opened straight off disk (`file://`) it works too, but some browsers refuse
the cross-origin POST from there, and you get no home-screen icon.

## Gotchas that have already cost time

- **Editing the script is not enough — redeploy.** Apps Script serves the
  deployed version. Deploy → Manage deployments → pencil → Version: New
  version → Deploy. Same URL, no app changes needed.
- **The Apps Script time zone.** See step 4. Check it before trusting a
  single timestamp.
- **Previewing the HTML inside Claude** puts it in a sandbox that blocks
  outbound requests, so the connection test fails. Download it and open it
  properly.
- **Settings are per-origin.** Move the file to a different URL and you
  enter the URL and token again. The data is unaffected — it comes from the
  Sheet.
- **Backfill scripts append.** Running one twice duplicates every row.

## Backing up

Export → `attack-log-backup.json`, into Drive alongside the Sheet, every few
weeks. The Sheet is the record; the JSON is the belt and braces.

## Not medical advice

The scores are screening tools for spotting patterns and for showing a
clinician what actually happened. They diagnose nothing, and the medication
thresholds are a prompt to have a conversation with a GP, not a rule to
self-manage against.
