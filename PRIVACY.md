# CleanURL privacy policy

_Effective 13 October 2026._

CleanURL removes tracking parameters from the links you open and copy. It does
this entirely inside your browser. **It collects no data, and sends nothing
anywhere.**

## What CleanURL reads

- **The address of pages you open, and links you copy or share.** It reads them
  only to remove tracking parameters, and only at the moment that happens. They
  are not kept, logged or sent anywhere.
- **Your clipboard, only when you press "Clean clipboard link"** in the popup.
  The browser asks for your permission the first time. The link is cleaned and
  written straight back, and nothing is kept.

## What CleanURL stores

Only on your device, in the browser's own extension storage:

- **Your settings:** the on/off switches, sites to leave alone, parameters to
  keep, and extra parameters to remove. They are kept in the browser's synced
  storage, so if you use your browser's sync (a Google account in Chrome, a
  Mozilla account in Firefox), the browser carries them to your other devices.
  CleanURL never sees or handles that sync.
- **Two counters,** the number of links and copies cleaned, shown in the popup.
  You can reset them there.

It does not store your browsing history, page contents, or anything you copy.

## What CleanURL sends

Nothing. It makes no network requests: no analytics, no tracking, no update
checks of its own, and no remote code or rules. The list of parameters it
removes is part of the extension.

The popup's **Source code** and **Report an issue** links open GitHub in a new
tab, only when you click them. A new issue is pre-filled with the CleanURL
version and your browser name, and nothing else. In particular, the address of
the page you are on is not included. Nothing reaches GitHub unless you submit
the issue, and GitHub's own privacy policy applies there.

## Debug build

The versions on the Chrome Web Store and addons.mozilla.org are not debug
builds. Someone who loads CleanURL from its source code gets a debug build. It
keeps a log of what was cleaned, including the addresses involved, in the
browser's memory only, so other developers can check its rules. The log is
cleared when the browser closes and is never sent anywhere.

## Changes and contact

Changes to this policy are published with the source code at
<https://github.com/paul2t/cleanurl>, where you can also ask questions by
opening an issue.
