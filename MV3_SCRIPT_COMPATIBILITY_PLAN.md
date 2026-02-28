# MV3 Script Compatibility Plan (Battle Stats Predictor)

Last updated: February 26, 2026

## Goal

Make `battle_stats_predictor_mv3.user.js` reliably execute under a Manifest V3 userscript manager (ProjectSaturn / Violentmonkey MV3), without `userscript.bootstrap.blocked` failures.

## What Current Diagnostics Already Prove

- The script is not failing JavaScript parse checks (`syntaxProbe.ok: true`).
- The failure class is runtime startup/bridge: `classification: bootstrap-blocked`.
- The script remains in `ID_INJECTING (2)` and never sends the expected start signal (`Run` transition).
- Therefore, this is an MV3 execution model mismatch (or extension runtime bridge issue), not a plain syntax problem in the script source.

## MV3 Rules That Matter (Research Summary)

1. `chrome.userScripts` must be enabled by user toggle in Chrome 138+ (per-extension "Allow User Scripts"), and availability must be checked at runtime.
2. `chrome.userScripts.register()` uses the `RegisteredUserScript` contract, which differs from `scripting.registerContentScripts()` (for example, `persistAcrossSessions` belongs to `scripting.RegisteredContentScript`, not `userScripts.RegisteredUserScript`).
3. `USER_SCRIPT` world is exempt from page CSP, while `MAIN` world is exposed to page context constraints.
4. MV3 service workers have no DOM; DOM-dependent work must move to an offscreen document.
5. `webRequestBlocking` is restricted in MV3; blocking/modifying flows should be moved to `declarativeNetRequest`.

## Execution Plan

## Phase 0 - Lock Baseline and Capture Hard Failure Signals

1. Clear diagnostics log and reproduce once on `profiles.php?XID=...`.
2. Capture only these events:
   - `userscript.bootstrap.blocked`
   - `userscript.content.execute.failed`
3. Export diagnostics JSON and tag with build ID.

Exit criteria:
- We consistently capture one primary failure signal per reproduce cycle.

## Phase 1 - Validate MV3 Registration Contract

1. Audit all `chrome.userScripts.register()` payload fields against current API docs.
2. Remove/guard any non-userScripts fields (`persistAcrossSessions` must never be sent to `userScripts.register`).
3. Verify per-script fields are normalized:
   - `id` (string, stable, unique)
   - `matches` populated and valid
   - `js` non-empty
   - `runAt` mapped to valid values
   - `world` explicitly selected (`USER_SCRIPT` default path)

Exit criteria:
- Registration succeeds with no API schema errors across reloads.

## Phase 2 - Isolate Bootstrap Failure Point

1. Add a "canary" script registration path that only executes:
   - `console.log("[MV3 canary] start")`
   - `postMessage("mv3-canary-started")`
2. Compare canary result vs BSP result in same tab/frame.
3. If canary starts but BSP stalls:
   - problem is script payload/runtime interactions.
4. If canary also stalls:
   - problem is manager bridge/injection path.

Exit criteria:
- Failure scope narrowed to either manager runtime or script payload behavior.

## Phase 3 - Script Refactor for MV3 Runtime Safety

1. Keep script in `content`/isolated world by default.
2. Remove/replace patterns that are brittle in MV3 manager pipelines:
   - dynamic inline `<script>` execution paths
   - string-eval forms (`setTimeout("...")`, `new Function`, `eval`)
3. Keep cross-origin calls on `GM.xmlHttpRequest` only (no fallback to page-context network hacks).
4. Gate startup with explicit async init:
   - top-level `try/catch`
   - deterministic early log markers
   - fail-closed diagnostics payload when init aborts

Exit criteria:
- Script emits startup marker and runs core feature path on profile pages.

## Phase 4 - Bridge and World Strategy

1. Treat `USER_SCRIPT` world as primary.
2. If page-world access is required, use a minimal, explicit bridge path instead of broad main-world execution.
3. Keep manager internals from relying on page-inline execution patterns that trigger CSP/handshake breakage.

Exit criteria:
- No `bootstrap-blocked` events in repeated runs on target Torn pages.

## Phase 5 - MV3 Operational Hardening

1. Ensure `userScripts` availability check is run on startup and after toggle changes.
2. If unavailable, surface actionable UI guidance (toggle path, reload requirement).
3. Keep diagnostics labels accurate:
   - "Open script" when no line/column exists.
   - "Open at error" only for real location data.

Exit criteria:
- Users get clear remediation instructions instead of ambiguous syntax messaging.

## Test Matrix (Required)

1. Chrome stable (138+) with Allow User Scripts OFF -> expected unavailable state.
2. Chrome stable (138+) with Allow User Scripts ON + extension reload -> expected available state.
3. Torn profile page cold load.
4. Torn SPA-like navigation transitions.
5. Multiple rapid reloads to catch race conditions.

Pass criteria:
- No `userscript.bootstrap.blocked` for BSP in 20 consecutive profile-page loads.
- No manager-side runtime exceptions in injected bridge path.

## Immediate Next Actions for This Repo

1. Reproduce once and collect `userscript.content.execute.failed` (now instrumented).
2. Add canary user script registration test path.
3. Run side-by-side canary vs BSP on same URL and compare lifecycle transitions.
4. Refactor BSP startup path only after canary result isolates root cause.

## References

- Chrome `userScripts` API: https://developer.chrome.com/docs/extensions/reference/api/userScripts
- Chrome change note for userScripts toggle (Chrome 138+): https://developer.chrome.com/blog/chrome-userscript
- Chrome content scripts + CSP + isolated worlds: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- Chrome `scripting` API (`persistAcrossSessions` on `RegisteredContentScript`): https://developer.chrome.com/docs/extensions/reference/api/scripting
- MV3 service worker migration notes: https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers
- Chrome `offscreen` API: https://developer.chrome.com/docs/extensions/reference/api/offscreen
- MV3 webRequest blocking migration: https://developer.chrome.com/docs/extensions/develop/migrate/blocking-web-requests
- Chrome webRequest MV3 note (`webRequestBlocking` restrictions): https://developer.chrome.com/docs/extensions/reference/api/webRequest
