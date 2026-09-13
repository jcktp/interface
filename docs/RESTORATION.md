# Capability restoration: Interface 0.3

The initial rebuild removed too much product behavior. The goal is a simpler runtime
and maintainable modules, not a directory-only HRIS. This pass restores connected
workflows and makes the remaining gaps explicit.

## Comparison with the original build

Reviewed original commit `a6ac2237d281e45cd5f733e5e24c10920e06a4fd`, including
[employee models](https://github.com/jcktp/interface/blob/a6ac2237d281e45cd5f733e5e24c10920e06a4fd/backend/database/models.py),
[recruitment service](https://github.com/jcktp/interface/blob/a6ac2237d281e45cd5f733e5e24c10920e06a4fd/backend/services/recruitment_service.py),
[performance service](https://github.com/jcktp/interface/blob/a6ac2237d281e45cd5f733e5e24c10920e06a4fd/backend/services/performance_service.py)
and the original page inventory. A page's existence does not establish that every
workflow behind it was complete; for example, the old metrics calculator also had
sample metric values. Those values are not carried forward.

| Original capability / requested workflow | Available now | Still to restore or extend |
|---|---|---|
| Employee records and employment context | Directory, dates, previous employer, contract type/hours/salary/terms/location/manager text, private employee portal | Full employment/contract history, manager relationships and organization tree, document upload/e-signatures |
| Quality of hire | Recorded 0–100 assessments with basis/date, assessment history, recruiter/source/department/previous-employer cohorts, quarterly cohorts, score distribution and coverage | Configurable assessment rubrics, review campaigns, richer filters and scheduled follow-ups |
| Recruitment | Ashby hired-application inbox with job, recruiter/hiring manager and source, reviewed employee creation, application-to-decision duration and recorded hiring costs | Full candidate funnel, requisition budgets, opening history, offer/start-date API enrichment, reviewed linking to existing employees |
| Performance and engagement | Recorded performance/engagement metrics, sample counts and assessment snapshots | Review cycles, goals, feedback collection, pulse surveys and survey privacy controls |
| Retention | Historical 90-day retention with eligible and unknown counts | Rehire intervals, richer cohort retention, attrition/cause analysis; no unvalidated individual flight-risk prediction |
| Compensation / workforce planning | Contract salary, hours and currency; existing headcount cost scenarios and revenue/profit per employee | Equity, pay-band/compensation review workflows, departmental budgets and hiring ramps |
| Attendance / time off | Employee request/approval/cancellation, explicit annual allowances and weekday balances, sickness reporting/amendment/cancellation | Holiday calendars, work schedules, accrual/carryover, partial days, policy-based cancellation approval and attendance clocks |
| Data management | CSV column mapping, all-row validation, preview, create/update modes, concurrency checks, atomic commit and retry protection | XLSX, saved mappings, background large imports and complete data-export/report builder |
| Payroll information | Encrypted/masked bank details and audited HR CSV export with contract pay fields | Payroll vendor reconciliation, approval of bank changes and payroll submission |
| Custom reports / dashboards / benchmarks | Standard HR, hiring and workforce screens backed by actual records | User-built dashboards, saved reports, sharing and sourced benchmarks |
| AI / ML / query editor | Optional read-only MCP interface retained | Permission-aware workflow tools and optional AI; no mandatory model runtime or arbitrary SQL UI |

## Use the new workflows

### Bring in existing records

Open **Import data**, choose a UTF-8 comma-separated CSV, map columns, select create
only or create/update mode, and review the preview. Name and work email mappings are
required. Up to 1,000 rows and 2 MB per batch. Dates use `YYYY-MM-DD`.

Optional fields include directory fields, employment start/end, previous company,
recruiter, hiring manager, job ID/title, location, source, application/decision dates,
quality score/date/basis, performance, engagement and hiring cost/currency. Personal,
bank and contract salary data are not imported through this CSV workflow yet.

Blank cells preserve existing values during updates; they do not clear fields. Updates
match the unique work email. Duplicate emails within a file fail validation. All rows
must pass before a batch can commit. Fix errors and upload again; the screen offers an
error CSV. Previews expire after an hour and belong to the initiating administrator.
A concurrent edit rejects the commit without partial changes. Repeating a successful
commit within the preview lifetime returns its original result. Committed preview
payloads are cleared. Imports never create accounts or send invitations.

### Review ATS hires

Add **Ashby · hired applications** in Connectors, using the same API-key environment
reference and `candidatesRead` permission. Sync pages, then open **Hire inbox**. Candidate,
job and hiring-team data come from Ashby's documented
[application.list](https://developers.ashbyhq.com/reference/applicationlist) response.
Only team members whose roles identify recruiter/hiring manager fill those fields;
credited-to users are not silently relabeled as recruiters.

HR confirms name, work email, employment start, department and recruiter, and optionally
records the hiring decision date. The list endpoint used here does not provide a
reliable hiring decision/start date, so neither is fabricated from `updatedAt` or the
application date. After confirmation, the employee, employment and hiring context are
saved together. Repeat acceptance returns the existing employee. Existing work-email
matches are rejected for review rather than overwritten. Source IDs and imported status
survive later syncs. This is not a complete ATS replacement or hiring-funnel sync.

### Employee and HR workspace

Named users open **My workspace** to view their information, update personal/emergency
contacts, replace bank details, read their contract and manage absences. Contract and
hiring fields cannot be changed by employees. HR opens **Employee record** beside a
person to manage employment, contract, annual allowance and hiring assessments.

Personal/emergency and bank payloads are encrypted with the application's private key.
Bank reads show only the last four account characters; replacement requires the full
account again. IBAN structure/checksum is validated; local account format requires a
routing code but is not validated with a bank. This does not verify account ownership.
Bank changes are immediate, recorded in the activity journal, and do not initiate pay.

**Import data → Export payroll details** produces an HR-only CSV for active people
with bank records. It includes full bank/routing details and available contract salary,
hours and currency. This export is audited; it is not payroll calculation or submission.
Treat account/routing columns as text when importing into payroll software. Formula-like
text is prefixed with an apostrophe for spreadsheet safety.

### Absences

HR sets an annual allowance for the current year in Employee record (other years are
available through the API). No default entitlement is invented. Balances subtract
approved annual-leave Monday–Friday days; pending requests are reported separately.
Cancellation restores the corresponding balance automatically. Requests can exceed an
allowance and show a negative balance; HR approval remains the decision point.

Sickness is reported immediately, with no diagnosis required and no annual-leave
reduction. Employees can amend the last sick day or cancel a report. Overlaps are
blocked. The UI labels the underlying approved sickness state as **Reported**.
This release does not implement jurisdiction-specific leave entitlements or scheduled
workdays/public holidays; the calculation basis is visible in the app.

## Metric definitions

- Quality of hire is the average of explicitly recorded current scores, from 0 to 100.
  Zero counts as a score; missing scores do not. Assessment date and basis are required.
  Changes retain prior assessment snapshots. Cohorts are descriptive, not automated
  selection, promotion or termination recommendations. Comparing different scoring
  rubrics can be misleading; the basis remains available on the employee record.
- Performance uses recorded 1–5 ratings, engagement recorded 0–100 values. Each has its
  own visible sample size. Neither is inferred from source company, demographics or ATS stage.
- Quarterly cohorts use employment start date; January–March is Q1. Hire-date filters
  exclude missing employment starts when a date bound is supplied.
- 90-day retention includes only people whose start + 90 days has elapsed. They count
  as retained if no end is recorded for an active person, or the last employed date is
  at/after that milestone. Inactive people without an end date are reported as unknown
  and excluded. Recent hires are not treated as retained or lost prematurely.
- Hiring-cycle duration is application date to hiring-decision date for complete pairs.
  It is not requisition-open-to-fill time. Hiring costs are recorded amounts averaged
  separately per currency; missing costs are not zero.

## Deployment and data preservation

No Redis, queue server, frontend build or model runtime was added. SQLite remains the
storage layer; services and repository contracts own policy and transactions. Cryptography
is now a base dependency for personal/bank encryption. Private values never enter the
public directory or MCP search.

**Back up `data/private.key` with the database, separately and securely.** Losing it
makes encrypted personal and bank details unreadable. Do not commit it. Existing
instances migrate additively; the operator's local database was backed up before this
upgrade. Fresh installations still contain no people, accounts or demo data.
