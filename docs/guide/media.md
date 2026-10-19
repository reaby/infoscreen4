---
title: Media and fonts
parent: User guide
nav_order: 3
---

# Media and fonts
{: .no_toc }

1. TOC
{:toc}

## Media libraries

Uploaded files are stored under `data/`, one folder per library:

| Library | Folder | Used for |
|:--|:--|:--|
| Images | `data/images/` | Image slides and image objects in editor slides |
| Videos | `data/videos/` | Video slides and video objects in editor slides |
| Backgrounds | `data/backgrounds/` | Bundle background images and looping videos |
| Fonts | `data/fonts/` | Custom fonts for the editor and displays |

Upload, rename and delete files from the file manager dialogs in the admin and the editor. You can also copy files straight into these folders on the server.

{: .tip }
For background and slide videos, use H.264 MP4 at the display's resolution. It plays smoothly even on low-power display machines.

## Fonts

Open **Manage fonts** in the editor.

![The Font Manager]({{ '/assets/images/screenshots/font-manager.png' | relative_url }})

- **Custom fonts**: upload `.ttf`, `.otf`, `.woff` or `.woff2` files.
- **Google Fonts**: add a family by its name. It becomes available in the editor and on all displays. The list is stored in `data/fonts/google-fonts.json`.
- **Built-in fonts**: a set of common fonts that is always available.

{: .note }
Google Fonts are loaded from `fonts.googleapis.com`, so display machines need internet access to use them. On an offline LAN, upload the font files as custom fonts instead.
