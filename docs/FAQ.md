# Whistle — FAQ

Common questions about how the platform works, for each role. See [`PLATFORM_FLOW.md`](./PLATFORM_FLOW.md) for the full end-to-end walkthrough.

---

## General

**What is Whistle?**
A multi-sport academy & school management platform with three built-in competition systems: internal training/assessment, **Match Center** (schools vs. schools), and open **Tournaments** (anyone). Whistle (the company) sells it to academies and schools and meters usage per student.

**What are the different apps / logins?**
- **Admin console** (web) — Platform Owner, Admin, Account Manager.
- **Coach app** — Head Coach, Coach.
- **Parent app** — Parent.
- **Tournament portal** (`/organizer`, `/play`, public `/t/<slug>`) — Organizer, Official, Player. These are standalone accounts, unrelated to any academy login.

**What's the demo password?**
All demo accounts use `whistle123` on the local machine. This is for testing only — reset every account (especially `owner@whistle.app`) before going public.

---

## Platform Owner (Whistle)

**How do I add a new academy or school?**
`/platform → Academies & Schools → Onboard Academy / School`. Enter the academy name, the admin's login email + password, a student allowance + billing mode, and optional branding (display name, font, logo). One submit creates the academy, its admin, its grades and its subscription.

**Why don't tenants have a "Schools" menu anymore?**
Academies organise around **Centers**, not a separate Schools entity. Each school is onboarded by Whistle as its own tenant. Tenants add Centers; the owner adds schools/academies.

**What's the difference between "hard cap" and "true-up" billing?**
- **Hard cap** blocks the N+1th student once the allowance is reached.
- **True-up** lets the academy grow freely and bills the real student count at period close.
You can switch modes or raise the allowance for any academy at any time.

**Can I see everything happening across all academies?**
Yes:
- **CRM** — students + enquiry pipeline across the whole network.
- **Match Center** — cross-school interschool standings + every event.
- **Tournaments** — every tournament on the platform.
- **Overview** — revenue, largest academies, recent invoices.

**Do I control the training content?**
Yes. The **Drill Bank**, **Lesson Plans** and **Assessments** libraries are curated by you. Academies read them (filtered to the sports you grant each academy) and adopt copies — they can't author the master content.

**Can I set up assessments?**
Yes — `/platform → Assessments` is your fitness-test library (a standard battery is seeded). Academies see these tests and build their own testing **cycles** (grade/class + window) around them, because a cycle needs the academy's own students and grades.

---

## Academy Admin / Account Manager

**What's the difference between an Admin and an Account Manager?**
Admin has full academy access. Account Manager is a "school admin" with default access — students, classes, centers, coaches — but not the full settings surface.

**Where do I add students?**
`Students` — individually or by CSV bulk import. Each student gets a link code you share with parents so they can follow their child.

**How do I use a lesson plan?**
Open `Lesson Plans` — you'll see the **Whistle repository** for your sports. Click **Use in my academy** to adopt an editable copy, then assign it to a class.

**Why can't I edit some lesson plans / drills?**
Those are Whistle's master library (marked 🏛 Repository). Adopt a copy to customise it — the master stays consistent for everyone.

**How does student billing work?**
You raise invoices under `Invoices`. Schools typically don't charge parents through the app; academies do. You can select several pending invoices and **batch** them into one bulk payment.

---

## Coach

**Where's my menu?**
The bottom tab bar (Home, Classes, Schedule, Assess, Lessons, Matches, Standings, Profile). If it's missing on the web preview, the app bundle is still loading or the Metro cache needs clearing — reload once it finishes bundling.

**How do I start a session?**
From `Schedule` or a class — check-in is geofenced (you must be within ~100m of the center) and biometric-confirmed.

**How do I host an interschool event?**
`Matches → Host`: name it, pick sport(s), set the number of team slots, choose the venue and the league/playoff plan, then publish. Other schools discover and join it.

---

## Match Center (schools vs. schools)

**Can other schools join an event I host?**
Yes. Publish an event with team slots and it becomes discoverable — any school can find it in their Match Center and **Join** while slots remain. No account-wide network setting is needed.

**Who plays whom?**
Fixtures are **between schools**. Each school nominates its **students** (the roster/team). Once every school's roster is in, fixtures auto-generate (round robin, grouped if you chose groups).

**How are standings calculated?**
The points table counts league-stage matches (2 points a win, 1 a draw). Overall player/team skill is tracked separately by the **DUPR-style rating**. Playoff results show on the bracket, not in the league table.

**How do results get confirmed?**
One side enters the result → it goes **pending** → the opposing coach confirms → it's final. A referee's result is final immediately.

**What happens after the league stage?**
If you configured playoffs (Final / Semis / Quarters), the host clicks "Generate playoff round" once the league is complete. The bracket is built from the standings (cross-group pairing for groups) and winners advance to the Final.

**Can parents see the matches?**
Yes — parents see the event, fixtures (including the Final) and standings for their child.

---

## Tournaments (open to anyone)

**Do I need an academy account to run or play a tournament?**
No. Tournaments have their own open accounts (Organizer, Official, Player) at `/organizer` and `/play` — completely separate from academy logins.

**How do I set up group stages and playoffs?**
When creating a league event, choose the group stage (1/2/4 groups) and how it resolves (table decides / Final / Semis / Quarters). After the league stage, generate the playoff bracket to the Final.

**How do officials get access?**
Sign up on `/play` as an Official, give the organizer your email; they appoint you and your scoring console appears on `/play`.

**Where can people follow a tournament without an account?**
Every tournament has a public microsite at `/t/<slug>` (fixtures, live scores, standings, champions). **Whistle Pulse** (`/rankings`) shows the podium, top players of the week/month, fresh champions and the cross-organizer leaderboard.

---

## Parent

**How do I link my child?**
Enter the student's link code (from the academy) in the Parent app. You can link multiple children and switch between them.

**What can I see?**
Your child's next session, rating, coach notes, assessment history and fitness zones, plus their Match Center fixtures, results and standings. You see your academy's name and logo top-right.

---

## Troubleshooting

**The coach/parent app menu (bottom tabs) is missing.**
The Expo web bundle is either still loading or the Metro cache is corrupted. Clearing the Metro cache and restarting the dev server fixes it; on a device/simulator this doesn't occur.

**A login lands on the wrong page.**
Platform Owner → `/platform`; Admin/Account Manager → `/dashboard`; other academy roles use the coach/parent apps; tournament accounts use `/organizer` or `/play`.

**"This academy's Whistle access is suspended."**
The Platform Owner suspended that academy. Every user of a suspended academy is locked out until it's reinstated from the owner console.

---

*Last updated: 2026-07.*
