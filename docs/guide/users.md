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

- When there are no users, the first login creates an **admin** account with the credentials entered.
- To change a password, delete the user and create it again.
- Sign-in sessions last 7 days.

{: .warning }
Passwords are stored in **plain text** in `data/users.json`. Use passwords that are not used anywhere else, and protect the file. See [Security](../reference/security).
