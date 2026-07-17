# WatchScribe

_[Direct Install](https://github.com/lyxal/WatchScribe/raw/refs/heads/main/WatchScribe.user.js)_

---

A handy dandy tool to generate regexes for smokey to watch.

Requires [FIRE](https://github.com/Charcoal-SE/userscripts/tree/master/fire)
to operate.


## How to Use

When viewing a report with FIRE, the WatchScribe widget will be at the bottom of the report:

<img width="1366" height="981" alt="image" src="https://github.com/user-attachments/assets/96f41533-c2ad-4feb-bab6-222f517ebc88" />


For a comprehensive list of the different types of commands WatchScribe can generate, you can go to the [Generation Heuristics](https://github.com/lyxal/WatchScribe/wiki/Generation-Heuristics) page.

### Normal Text Regexes

You can select text and click "Generate Regex" to add a watch command for that text to the regex list:

<img width="1374" height="1147" alt="image" src="https://github.com/user-attachments/assets/bddf6ba6-56ec-4845-882d-34c9be951a37" />


### Link Regexes

You can also select any part of a link and it will create commands for the link URL and the link text (if it isn't a URL itself):

<img width="1374" height="1144" alt="image" src="https://github.com/user-attachments/assets/bac732ec-c3bf-4a44-823f-029ee8bfe2ec" />



Further, if it looks like a link ends with an ID (like a t.co link), a case-insensitive regex will be generated with a comment containing the parent domain

<img width="1303" height="782" alt="image" src="https://github.com/user-attachments/assets/09bd73ce-ad37-4805-952c-8d38c4b4dd17" />

Selecting any part of the end of a link will also generate a case-insensitive regex.


### Sending Regexes to Chat

You can send any individual regex to chat by clicking the "Send to chat" button next to each regex. Alternatively, you can click "send all to chat" to send each one individually. This may lead to chat timeouts.

### Phone Number Watching

Furthermore, you can select a phone number to get corresponding number watching/blacklisting commands:

<img width="1378" height="1147" alt="image" src="https://github.com/user-attachments/assets/33e40dba-c4bc-4a17-9a2e-6d96e3c14c41" />


### Switching Between Watch and Blacklist

You can also make commands generate as their blacklist counterparts by switching to blacklist mode:

### Toggle Whether `-` is Appended to Commands

You can also silence or unsilence commands with the silent switch.

### Case Insensitive Regexes

Hold shift when clicking the "Generate Regex" button to make plain text commands wrap in `(?i-:)`:

<img width="1221" height="370" alt="image" src="https://github.com/user-attachments/assets/34c49447-cf8e-431d-ae18-f061262c7cb5" />

On mobile, holding down the generate regex button will toggle case insensitivity mode until next tap.

### Deleting Regexes

You can remove individual regexes from the list by clicking the red delete button:

<img width="1151" height="77" alt="image" src="https://github.com/user-attachments/assets/d4eacd20-af50-4acc-ba54-a0bcfba89edf" />

### Anchor Regex Button

The anchor button wraps a regex in `^$`:

<img width="1174" height="401" alt="image" src="https://github.com/user-attachments/assets/685428f9-bd6e-4d7d-b86b-58124b63e4de" />

## Keyboard Shortcuts

You can press <kbd>]</kbd> to enter regex sending mode:

<img width="1207" height="633" alt="image" src="https://github.com/user-attachments/assets/0304234c-3f91-43d5-a9f1-237b1da0b9f8" />

Pressing the key shown at the beginning of the regex will send that regex to chat. Pressing <kbd>enter</kbd> will send the top of the list, and then remove that regex from the list. Pressing <kbd>Tab</kbd> in regex sending mode will send all regexes.

Additionally:

* <kbd>w</kbd> Enter watch mode
* <kbd>b</kbd> Enter blacklist mode
* <kbd>/</kbd> Toggle current command mode
* <kbd>-</kbd> Toggle silent mode
* <kbd>Tab</kbd> Generate regex for selected text
* <kbd>Enter</kbd> (when inside custom text box) Generate from input box
* <kbd>]</kbd> Enable/Disable keyboard shortcut regex sending
* <kbd>`</kbd> Toggle the last generated regex(es) between watch and blacklist mode
* <kbd>c</kbd> Clear the regex list

## Positive Lookbehinds

If you select text from a report or enter text in the input box that matches the hostname of an already generated URL, the system will create a variant of the text regex that includes a positive lookbehind for that URL.
