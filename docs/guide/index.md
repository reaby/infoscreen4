---
title: User guide
nav_order: 3
has_children: true
permalink: /guide/
---

# User guide

How to run screens during an event: manage displays, build bundles and slides, and go live.

## Key concepts

| Term | Meaning |
|:--|:--|
| **Display** | A screen. It is a browser showing `/display/<id>`. Several browsers can open the same display ID and will mirror each other. |
| **Bundle** | An ordered playlist of slides plus shared settings: background, canvas size, default duration and transition. Each display plays one bundle at a time. |
| **Slide** | One item in a bundle: an editor slide, a video, or a website. |
| **Global slide** | Editor slides are stored in `data/slides/`, shared by all bundles. One slide can appear in several bundles, and editing it changes it everywhere. |
