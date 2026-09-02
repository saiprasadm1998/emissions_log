# Seed Credentials

One test user per role, for verifying the Section 8 authorisation matrix.
These are demo/assessment credentials only — not meant for any real
deployment (see note at bottom).

| Username     | Password | Role         |
|--------------|----------|--------------|
| data.entry   | admin    | DATA_ENTRY   |
| approver     | admin    | APPROVER     |
| auditor      | admin    | AUDITOR      |

## Creating these users on a fresh checkout

Not currently part of `npm run seed` (that script seeds reference/event
data only, not users). To create these three users after running
`npm run migrate`:

```bash
node -e "require('bcrypt').hash('admin', 10).then(console.log)"
```

Copy the resulting hash, then in psql:

```sql
INSERT INTO users (username, password_hash, role) VALUES
('data.entry', '<paste hash here>', 'DATA_ENTRY'),
('approver',   '<paste hash here>', 'APPROVER'),
('auditor',    '<paste hash here>', 'AUDITOR');
```

**Deliberate omission**: user creation isn't scripted into `npm run seed`
because the brief doesn't specify a real registration/onboarding flow,
and hardcoding demo credentials into a seed script felt like it would
blur "reference data" with "test accounts." A production system would
need a proper user-provisioning path instead. Flagging this as a gap
rather than silently leaving it undocumented.
