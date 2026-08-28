# @dariah-eric/seed

The kitchen-sink seed includes two working groups and a closed 2025 reporting campaign with a draft
country report and a draft working-group report, plus an open 2026 campaign without reports.
It also creates current coordinator, institution, consortium-service, and social-media relations used
to prepopulate new reports. The 2025 reports contain project-contribution and working-group social
media data that can be carried into reports created for 2026.

## Initial administrator bootstrap

Create the initial administrator with admin-management privileges from the `ADMIN_EMAIL`,
`ADMIN_NAME`, and `ADMIN_PASSWORD` environment variables:

```sh
pnpm bootstrap:users:admin
```

This is an operational bootstrap command, not a local data seed. It does nothing when an
administrator with admin-management privileges already exists.

## Local users

First seed the kitchen-sink entities, then create the local authorization personas:

```sh
pnpm data:seed:kitchen-sink
pnpm data:seed:users
```

All personas use the password `local-persona-password` and the same TOTP secret
`NRXWGYLMFVYGK4TTN5XGCLLUN52HAIJB`. Add that secret to one authenticator entry and use its current
six-digit code for every persona.

Scan this QR code with Authy or another authenticator:

![Local personas TOTP QR code](./assets/local-personas-totp.svg)

| Persona                     | Email                                           |
| --------------------------- | ----------------------------------------------- |
| Administrator               | `local-admin@example.com`                       |
| Country account             | `local-country@example.com`                     |
| National coordinator        | `local-national-coordinator@example.com`        |
| National coordinator deputy | `local-national-coordinator-deputy@example.com` |
| National coordination staff | `local-national-coordination-staff@example.com` |
| National representative     | `local-national-representative@example.com`     |
| Working-group member        | `local-working-group-member@example.com`        |
| Working-group chair         | `local-working-group-chair@example.com`         |
| No permissions              | `local-unprivileged@example.com`                |

The command is idempotent. It resets these users' password, actor connection, active relation, and
2FA key on every run, and invalidates their existing sessions.

The local working-group chair has active chair relations to both kitchen-sink working groups so the
multi-working-group dashboard navigation can be tested.
