# Whistle — Login-by-Login Test Template (Unit Tester)

A reusable checklist for regression-testing the whole platform. Work through it
**login by login, feature by feature.** Mark each: ✅ pass · ⚠️ minor · ❌ broken.

**All demo passwords: `whistle123`.** Servers: backend `:4000`, admin/owner/tournament
web `:3000`, coach app `:8081`, parent app `:8082`.

Re-run the automated backend suites anytime with the `*-verify` / `*-flow` scripts
in the session scratchpad (latest full run below).

---

## Global UI/UX rules (check on EVERY screen)

- [ ] **Background never changes** — the dark glass gradient is constant across all
  screens (mobile screens must not set their own solid background; admin pages use
  the same `bg-surface`/gradient).
- [ ] **Dropdowns are identical everywhere** — every select uses the shared
  `SelectField` (web) / chip-picker (mobile): same border, chevron, focus ring.
  *(Verified: 0 raw `<select>`/`<Picker>` outside the shared component.)*
- [ ] **Icons + infographics share the palette** — amber `accent` for primary,
  `textSecondary`/`textMuted` for inactive, tonal pills (success/warning/danger/info).
- [ ] **Long lists** have search and/or collapsible grouping (not a raw dump).
- [ ] **Every list row that shows a header opens a detail** with full content
  (description, media) — not just the header.

---

## 1. Academy Admin — `admin@whistle.test` · web `:3000`
- [ ] Dashboard: stat tiles + meters + collections ring render, numbers live
- [ ] Students: summary strip, search, status chips, grouped-by-class, row → detail
- [ ] Classes / Schedule: list, create, schedule a session
- [ ] Drill Bank: per-sport collapsible cards, each drill has description + ▶ video
- [ ] Lesson Plans: list → builder → add drills → **detail shows goals + drill videos**
- [ ] Enquiries / Clients / Renewals / Invoices / Attendance
- [ ] Match Center (interschool): host event → publish → fixtures → standings
- [ ] Whistle Standings (ratings lookup): pick student+sport → history
- [ ] Users, Reports, Settings, Communication
- [ ] Scrabble Word Lists: create list, add/remove words (starter list read-only)

## 2. Owner / Platform console — `owner@whistle.app` · web `:3000/platform`
- [ ] Tenants (Academies & Schools): list, student-cap/billing mode dropdown, branding
- [ ] CRM, Competitions, Match Center, Assessments (cross-tenant views)
- [ ] Invoices / revenue, content library (drills / lesson plans / assessments)
- [ ] A tenant admin gets 403 on `/platform/*` (isolation)

## 3. Coach — `coach@whistle.test` · coach app `:8081`
- [ ] Home: sessions today, my students, quick links
- [ ] Classes / Schedule / Assess (record a fitness test)
- [ ] **Lessons → open a lesson → GOAL + OBJECTIVES + per-drill description + ▶ video**
- [ ] Matches (Match Center): Registered / Discover tabs, join, **team chat**, fixtures
- [ ] Standings: emoji sport picker + medals + search
- [ ] Chess arena (bottom tab) · Scrabble arena (bottom tab)
- [ ] Profile → Log out

## 4. Parent — `parent@whistle.test` · parent app `:8082`
- [ ] Home + child selector (Aarav Demo linked)
- [ ] Progress dashboard + coach notes + My Rating
- [ ] Matches: browsable Whistle Standings (sport picker, medals, search), Match Center
- [ ] Chess arena · Scrabble arena (vs computer, puzzles, Word Power, Word Rush, community)
- [ ] Profile

## 5. Referee / scorer — `referee@whistle.test` · web `:3000`
- [ ] Referee console: assigned fixtures, per-sport score validation, result is final

## 6. Tournament organizer — `organizer@tourney.test` · `:3000/organizer`
- [ ] Create tournament (wizard), events, registration, payments, add officials
- [ ] Generate fixtures (knockout / league), play to final, awards
- [ ] Payment summary (platform fee + net payout)

## 7. Tournament official — `official@tourney.test` · `:3000/play`
- [ ] Scoring console: assigned matches, enter + validate scores, chess/scrabble board

## 8. Tournament player — `player1@tourney.test` · `:3000/play`
- [ ] Browse open tournaments, register, pay, see my matches / standings

## Public (no login)
- [ ] Whistle Pulse `:3000/rankings` — podium, hot players, fresh champions, career table
- [ ] Tournament microsite `:3000/t/<slug>` — live matches, standings, results (no PII)

---

## Latest automated backend run (all green — 223 checks)

| Suite | Covers | Result |
|-------|--------|--------|
| full-acceptance | caps, lessons, 200-student scale, Match Center, tournaments to final | 44/44 |
| e2e-roles | all 5 roles, permissions, geofence, LBL, scoring, rating confirm | ✅ all |
| match-center-full-flow | host→join→chat→fixtures→schedule→result→standings | 27/27 |
| match-center-messaging | 6 academies join, group chat, round-robin fixtures | 19/19 |
| chess-verify | engine, play, bot, puzzles, clocks | 21/21 |
| scrabble-verify | engine, bot, puzzles, Word Power, community, blocks | 22/22 |
| dupr-team-verify | individual + team ratings per sport | 10/10 |
| cricket-assessment-verify | ball-by-ball scoring + periodic assessments | 19/19 |
| platform-tier-verify | tenant caps, invoice batches, owner console isolation | 38/38 |
| tournament-seed-verify | standalone auth, wizard, fixtures, public microsite, payouts | 13/13 |
