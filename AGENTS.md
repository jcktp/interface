# Interface development

- Preserve the Interface name, layered logo, compact slate design and sidebar.
- Keep the system modular and object oriented. Use composition, explicit dependencies,
  typed data contracts, application services, policies and repository interfaces.
  HTTP, browser and MCP adapters must not implement their own domain rules.
- Lightweight means fast, accurate and maintainable. Measure performance and preserve
  transactional correctness; do not equate lightweight with the fewest source files.
- Never add seed files, demo commands or automatic sample data. Fresh instances start
  empty. Synthetic fixtures belong only in temporary tests/performance checks.
- Add capabilities incrementally according to docs/REBUILD.md. Do not restore old
  analytics/ML dependencies or expose arbitrary SQL/model-field mutation.
- Every write must validate explicit fields, authorize the actor and commit its event
  atomically. Add regression coverage for permissions, conflict handling and rollback.
- Do not claim production readiness before named identity and self-service policies
  are implemented and tested. Record validation limits accurately.
- Run pytest after behavior changes; use tests/performance_check.py for changes that
  affect query performance. Never commit access keys or application databases.
