# Evaluation: user-testing plan

> **Status: DRAFT.**
> The brief mandates testing with users ("otestujte s uživateli"); it is the step after the release; nothing else specifies it yet.
> This document proposes a methodology; the **open questions at the end need souki's decisions** before it is a plan.

## Goals

1. Validate the product's central usability claim (NFR3 in [07-requirements.md](./07-requirements.md)): a non-technical person can use the app without explanation, at Keep-level approachability.
2. Validate the self-hoster path: one person can bring up the server and connect their devices using only the documentation.
3. Validate the sync mental model: a user who hits a Conflicted Copy understands what happened and can repair it.

Each goal maps to one audience from `PRODUCT.md`: goals 1 and 3 to the household member, goal 2 to the self-hoster.

## Proposed method

**Moderated, task-based usability sessions** with think-aloud, followed by a **System Usability Scale (SUS)** questionnaire and a short semi-structured interview.

- **Participants:** 6-8 total, recruited as the two archetypes: 4-5 non-technical (the household member), 2-3 technically comfortable (the self-hoster). Small-n moderated testing finds the majority of usability problems; the paper should cite the usual Nielsen argument rather than claim statistical power.
- **Metrics:** task completion (assisted/unassisted/failed), time on task, error and hesitation counts from observation notes, SUS score, and qualitative findings. The app has no analytics by design (NFR2), so all data collection is manual observation plus the questionnaire - worth stating in the paper as a consequence of the privacy stance.
- **Environment:** per [ADR 0018](../adr/0018-the-server-serves-the-pwa.md), the supervised desktop test runs against `http://localhost` (a first-class path); the phone test installs the PWA via the Tailscale happy path. Sessions in the participant's preferred locale (`cs` expected for most).
- **Consent:** written consent for observation and note-taking; recordings only if the participant agrees; no note content retained after the session.

## Task battery (proposal)

### Session A - daily surface (all participants, phone first)

1. First open: the Welcome, then the Tour on the first visit to Settings (observe: skipped or followed? anything re-explained later?).
2. Capture a note one-handed while "walking out the door" (the product's defining scenario).
3. Make a shopping checklist; check two items off; observe the sinking behavior comprehension.
4. Attach a photo and record a short audio note.
5. Label a note "Work", give it a color, then find it again a day's-worth-of-notes later via search and via the label.
6. Archive one note, trash another, restore the trashed one.
7. Change theme and one customisation (toolbar or quick-capture order); observe whether Settings is findable.

### Session B - ownership (self-hoster archetype)

1. Bring up the server from the setup guide alone (compose + one Caddy mode); moderator intervenes only on request, and every intervention is a documentation finding.
2. Create the Owner account, issue an Invite, sign a second account in on another device.
3. Export a backup; restore it; say aloud what they believe just happened.
4. Revoke a "lost" device from Settings.

### Session C - sync comprehension (both archetypes)

1. Edit the same note on two devices with one offline; reconnect; find and resolve the Conflicted Copy.
   Success is the participant explaining in their own words which version is where, and deleting the right one without fear.
2. Sign out on a shared machine; verify the participant expects (or is at least unsurprised by) the local erase after the dialog explains it.

## Schedule and iteration

Two rounds: a **pilot round** (2 participants, Session A only), to shake out task wording and instrument the observation sheet; then the **main round**, with the setup guide for Session B.
Findings feed the polish that follows; the paper reports both rounds and what changed between them.

## Open questions (need decisions)

1. Participant count and recruitment: is 6-8 from souki's circle acceptable to the thesis supervisor, or is a different n/profile expected?
2. Are sessions recorded (screen and/or audio), or observation notes only?
3. Is SUS the right questionnaire for the paper, or does the faculty expect a specific instrument (e.g. UEQ)?
4. Does Session B include the DNS-01 and internal-CA Caddy modes, or only the Tailscale happy path?
5. Formal ethics: does the university require an ethics/consent template for this kind of study?

## For the paper

- Report method, participants, tasks, metrics, findings, and the changes made in response - the loop closing is what the brief's "test with users" is really asking for.
- The no-analytics constraint forcing manual observation is an honest, defensible methodological consequence of the privacy positioning.
- Session C is the novel part: usability evaluation of a *conflict model*, not just of screens.
