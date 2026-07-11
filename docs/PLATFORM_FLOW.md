# Whistle — Complete Platform Flow

*Multi-sport academy & school management, interschool competition, and open tournaments — one platform, four surfaces.*

This document is the end-to-end reference for how Whistle works: who logs in where, what each role can do, and how every module flows from start to finish.

---

## 1. The big picture

Whistle is sold by **Whistle (the platform company / operator)** to **academies and schools**. Each academy/school is a **tenant** with its own students, coaches, parents, classes and billing. Whistle meters usage per student and curates a shared content library.

```
Whistle (Platform Owner)
├── curates the shared library (drills, lesson plans, assessments)
├── onboards & meters every academy / school
└── sees network-wide CRM, Match Center standings, revenue
        │
        ├── Academy / School  (tenant)
        │   ├── Admin        — runs the academy (full access)
        │   ├── Account Manager — school admin (default access)
        │   ├── Head Coach / Coach — deliver sessions, host events, score
        │   ├── Referee      — dedicated scorer (results are final)
        │   ├── Parent       — follows their child
        │   └── Students     — the players
        │
        └── Tournaments (standalone, open to anyone)
            ├── Organizer    — creates & runs tournaments
            ├── Official     — scores appointed matches
            └── Player / Registrant — enters, pays, plays
```

### The four surfaces

| Surface | URL / App | Who uses it |
|---|---|---|
| **Admin console** | `localhost:3000` (web) | Platform Owner, Admin, Account Manager |
| **Coach app** | Expo app / `localhost:8081` (web) | Head Coach, Coach |
| **Parent app** | Expo app / `localhost:8082` (web) | Parent |
| **Tournament portal** | `localhost:3000/organizer` + `/play` + public `/t/<slug>` | Organizer, Official, Player — no academy account needed |

---

## 2. Roles & where they log in

All demo accounts share the password **`whistle123`** (local demo only — change before production).

| Role | Login page | Lands on | Key powers |
|---|---|---|---|
| **Platform Owner** | `/login` | `/platform` | Onboard academies, meter students, curate library, network-wide reports |
| **Admin** | `/login` | `/dashboard` | Everything inside their own academy |
| **Account Manager** | `/login` | `/dashboard` | School admin — students, classes, centers, coaches |
| **Head Coach / Coach** | Coach app | Home | Deliver sessions, mark attendance, host Match Center events, score |
| **Referee** | `/login` or `/play` | scoring console | Enter results (final, no opponent approval needed) |
| **Parent** | Parent app | Home | Child's progress, lesson plans, ratings, Match Center results |
| **Organizer** | `/organizer` | organizer console | Create & run tournaments |
| **Official** | `/play` | scoring console | Score matches of tournaments they're appointed to |
| **Player** | `/play` | portal | Browse, register, pay, play, follow results |

---

## 3. Platform Owner flow (Whistle)

The operator console lives at `/platform` with a left sidebar:

- **Overview** — network revenue, largest academies, recent platform invoices.
- **Network → Academies & Schools** — onboard a new academy/school (name, admin login, student allowance, billing mode, branding: display name + font + logo). Expand any academy to manage its allowance, sport access, branding, billing period, or to suspend/reinstate.
- **Network → CRM** — enrolment + enquiry pipeline across every academy.
- **Network → Invoices** — platform invoices raised to academies.
- **Content Library → Drill Bank / Lesson Plans / Assessments** — the master libraries every academy reads. The owner authors them; academies adopt copies.
- **Competitions → Match Center** — cross-school interschool standings + event oversight.
- **Competitions → Tournaments** — every tournament running on the platform.

**Onboarding an academy (end to end):**
1. Owner opens **Academies & Schools → Onboard Academy / School**.
2. Fills the academy name, the admin's login email + password, student allowance + billing mode (`hard` cap or `true-up`), and optional branding (display name, font, logo).
3. Submit → the academy, its admin user, its grades, and its Whistle subscription are all created in one step.
4. That admin now logs in at `/login` and sees only their own academy.

**Metering:** `hard` mode blocks the N+1th student; `true-up` lets them grow and bills the real count at period close. The owner can raise the allowance or switch modes any time.

---

## 4. Academy Admin / Account Manager flow

After the owner onboards them, the academy admin logs in at `/login` and manages their academy from the sidebar:

1. **Centers** — create the physical center(s) with a map pin (used for geofenced check-in and event discovery ranking).
2. **Plans** — create membership/fee plans.
3. **Classes** — create classes (sport + center + coach + lesson-plan mode: calendar or grade-sequence).
4. **Students** — add students individually or by CSV bulk import; each gets a link code for parents.
5. **Enquiries (CRM)** — track leads → convert to students on a plan.
6. **Lesson Plans** — browse the **Whistle repository** (filtered to your granted sports) and "Use in my academy" to adopt an editable copy; assign to classes.
7. **Assessment Tests / Cycles** — adopt tests from the Whistle library, then schedule testing cycles (grade/class + window) for your students.
8. **Schedule / Timetables** — plan sessions.
9. **Invoices** — raise fees; batch multiple invoices into one bulk payment.
10. **Users** — add coaches, head coaches, referees with module access.
11. **Reports** — attendance, revenue, ratings.

> Academies organise around **Centers**, not a separate "Schools" entity — Whistle onboards each school as its own tenant.

---

## 5. Coach flow (Coach app)

1. **Home** — today's sessions, your students, live matches; your academy's brand shows top-right.
2. **Classes / Schedule** — see your classes; start a session with geofenced + biometric check-in.
3. **Lessons** — the lesson plan for each session (calendar or grade-sequence).
4. **Assess** — run fitness tests and record best-of-attempts results.
5. **Matches (Match Center)** — host or join interschool events (see §7).
6. **Standings** — DUPR-style ratings for your players.
7. **Profile** — attendance, settings.

---

## 6. Parent flow (Parent app)

1. **Home** — next session, child's rating, coach notes; the child's academy brand shows top-right.
2. **My Child** — switch between children (linked by the student's link code).
3. **Progress** — assessment history, fitness zones, coach notes.
4. **Matches (Match Center)** — the child's event fixtures, results and standings.
5. **Profile** — link another child, settings.

---

## 7. Match Center flow (interschool competition) — the flawless journey

This is how schools compete against each other. Fixtures are **between schools**; each school's **students/team** are its roster.

```
Host lists event → publishes → other schools DISCOVER → JOIN → team chat
   → each school nominates its roster (students) → fixtures AUTO-GENERATE
   → host schedules times/courts → results entered + opponent-confirmed
   → standings (matches + points) → playoffs (Final/Semis/Quarters)
   → host closes event (chat locks)
```

**Step by step:**

1. **Host lists an event** (Coach app → Matches → Host): name, sport(s), format, age bands, **team slots (maxTeams)**, venue (from the academy's centers), and the **league/playoff plan** (one table or 2/4 groups; after the league: table decides / Final / Semis / Quarters).
2. **Publish** — the event becomes discoverable. *An open capped event is discoverable and joinable by any school — no account-wide network setting required.*
3. **Other schools discover & join** — schools see the open event in their Match Center, open it, and **Join** while slots remain. The host counts as one team.
4. **Team chat** — host + joined schools message each other until the event closes.
5. **Rosters** — each school nominates its **students** for each sport. When the last roster lands, **fixtures auto-generate** (round robin, group-tagged if grouped).
6. **Scheduling** — the host sets time + court per fixture (host-only).
7. **Scoring** — one side enters the result → it goes **pending** → the opponent confirms → it's **final**. (A referee's result is final immediately.)
8. **Standings** — a per-sport points table (2 pts a win, 1 a draw) built only from the **league stage**; overall player/team skill is tracked by the **DUPR-style rating**.
9. **Playoffs** — once the league stage is complete, the host confirms the playoff round; the bracket is built from the standings (cross-group pairing for groups) and winners advance to the Final.
10. **Close** — when every match is settled, the host closes the event; the chat locks and standings freeze.

**Parent visibility:** parents see the event, its fixtures (including the Final) and standings for their child throughout.

*(Verified end-to-end: 27/27 automated checks — discovery, join, chat, rosters, auto-fixtures, scheduling, score+confirm, standings, playoff Final, parent view, close.)*

---

## 8. Tournament flow (standalone, open to anyone)

Tournaments are **separate from academies** — anyone can organize, officiate or play with a tournament account.

**Organizer** (`/organizer`):
1. Log in / sign up (centered login card).
2. **Create a tournament** — name, dates, venues, and one or more **events** (sport, individual/team, knockout / round robin / league). For league events, choose the **group stage** (1/2/4 groups) and **progression** (table decides / Final / Semis / Quarters) up front.
3. **Publish** → registration opens.
4. **Registrations** — approve entries (or use Quick Entries to paste names).
5. **Generate fixtures** — knockout bracket or group round robin.
6. **Score** — organizer or appointed officials enter results; times/courts per match.
7. **Proceed to playoffs** — once the league stage is complete, build the bracket to the Final.
8. Champions, awards and cross-tournament rankings publish automatically.

**Player / Official** (`/play`):
- **Player**: browse open tournaments, register, pay the entry fee, play (including online chess), follow results.
- **Official**: after the organizer appoints you by email, your scoring console appears on `/play`.

**Public** (`/t/<slug>` and `/rankings`):
- Every tournament has a public microsite (no login) with fixtures, live scores, standings and champions.
- **Whistle Pulse** (`/rankings`) is the public engagement dashboard: podium, top players of the week/month, fresh champions, and the cross-organizer career leaderboard.

---

## 9. Content library (owner-curated, academy-adopted)

Three master libraries live on the **platform owner** and are read by every academy (filtered to their granted sports):

| Library | Owner curates at | Academy uses at |
|---|---|---|
| **Drill Bank** | `/platform/drills` | Read-only in lesson-plan building |
| **Lesson Plans** | `/platform/lesson-plans` | View repository → "Use in my academy" (adopt editable copy) |
| **Assessment Tests** | `/platform/assessments` | Adopt into testing cycles (grade/class + window) |

Academies never author the master library; they adopt copies. This keeps content consistent across the network while letting each academy customise.

---

## 10. Billing

- **Platform → Academy:** Whistle bills each academy per student (declared strength vs. actual, `hard`/`true-up`), raised via "Close billing period" on the owner console.
- **Academy → Students:** academies raise student invoices; schools may not charge parents through the app, academies do. Multiple invoices can be **batched** into one bulk payment.

---

*Last updated: 2026-07. See [`FAQ.md`](./FAQ.md) for common questions.*
