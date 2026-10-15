---
title: Slide editor
parent: User guide
nav_order: 2
---

# Slide editor
{: .no_toc }

The editor (`/admin/editor`) is a visual canvas built on Fabric.js. Slides are saved as JSON files in `data/slides/`.

1. TOC
{:toc}

## Toolbar

| Group | Tools |
|:--|:--|
| **File** | New slide, Load slide, Save slide, Back to admin |
| **Insert** | Add Text, Add Rectangle, Add Image from file, Add Video from file |
| **Text** | Font, Font size, Font weight, Italic, Underline, Align left / center / right / justify |
| **Style** | Fill color, Stroke color, Stroke width, Border radius |
| **Arrange** | Align left / right edges, Center horizontally / vertically / both |
| **View** | Zoom in / out, Zoom 1×, Fit to screen |
| **History** | Undo, Redo |
| **Other** | Manage fonts, Shortcut help |

{: .tip }
Editor slides are shared. If a slide is used in several bundles, saving it changes it in all of them.

## Keyboard shortcuts

Click **Shortcut help** in the toolbar to see these in the editor.

### Navigation

| Shortcut | Action |
|:--|:--|
| <kbd>Ctrl</kbd> + mouse wheel | Zoom in / out |
| <kbd>Ctrl</kbd> + <kbd>+</kbd> / <kbd>Ctrl</kbd> + <kbd>-</kbd> | Zoom in / out in 10% steps |
| <kbd>Ctrl</kbd> + <kbd>0</kbd> | Reset zoom to 100% (the top-row zero key, whatever its label on your layout) |
| Middle mouse drag | Pan the canvas |

### Editing

| Shortcut | Action |
|:--|:--|
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Undo |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | Redo |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | Remove the selected object |
| Arrow keys | Nudge the selected object |
| <kbd>Ctrl</kbd> + arrow keys | Nudge in larger steps |
| Hold <kbd>Ctrl</kbd> while rotating | Snap to 15° steps |
