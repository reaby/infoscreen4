---
title: Users and roles
parent: User guide
nav_order: 6
---

# Users and roles

Manage accounts in the admin under the **user menu → User management**. Accounts are stored in `data/users.json`.

| Role | Can do |
|:--|:--|
| **Admin** | Everything: admin interface, editor, user management, streaming. |
| **Streamer** | Sign in to `/send` and broadcast a stream. |

- **First account.** When there are no users, the sign-in page shows **Create account**. Enter a username, password and the setup code printed in the server console. This first account is always an admin.
- **Changing a password.** Delete the user and create it again, or edit `data/users.json` by hand.
- **Sessions** last 7 days. Deleting a user signs them out everywhere.
- **Failed sign-ins.** After 5 failed attempts, the account is locked for 60 seconds for that address.

{: .warning }
Passwords are stored in **plain text** in `data/users.json`. Use passwords that are not used anywhere else, and protect the file. See [Security](../reference/security).
