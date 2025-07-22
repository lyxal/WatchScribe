# WatchScribe

_[Direct Install](https://github.com/lyxal/WatchScribe/raw/refs/heads/main/WatchScribe.user.js)_

---

A handy dandy tool to generate regexes for smokey to watch.

Requires [FIRE](https://github.com/Charcoal-SE/userscripts/tree/master/fire)
to operate.


## How to Use

When viewing a report with FIRE, the WatchScribe widget will be at the bottom of the report:

<img width="1371" height="877" alt="image" src="https://github.com/user-attachments/assets/bc52dfba-f2bb-45d3-87eb-e70fb50c694a" />

### Normal Text Regexes

You can select text and click "Generate Regex" to add a watch command for that text to the regex list:

<img width="1377" height="877" alt="image" src="https://github.com/user-attachments/assets/cca389fa-4195-4efa-b85d-460f0d4f70c7" />

<img width="1155" height="80" alt="image" src="https://github.com/user-attachments/assets/cfc4fa56-690a-436e-802f-bd4cc673f0e8" />

### Link Regexes

You can also select any part of a link and it will create commands for the link URL and the link text (if it isn't a URL itself):

<img width="1380" height="946" alt="image" src="https://github.com/user-attachments/assets/ab064297-6eea-4aae-99e4-ac36f542ae14" />


<img width="1164" height="214" alt="image" src="https://github.com/user-attachments/assets/1344e2a7-2256-495c-91b9-7fb27804c4ff" />

Further, if it looks like a link ends with an ID (like a t.co link), a case-insensitive regex will be generated with a comment containing the parent domain

<img width="1303" height="782" alt="image" src="https://github.com/user-attachments/assets/09bd73ce-ad37-4805-952c-8d38c4b4dd17" />

Selecting any part of the end of a link will also generate a case-insensitive regex.

### Freeform Regexes

Additionally, you can type any keyword you want and click "Add to list":

<img width="1372" height="1146" alt="image" src="https://github.com/user-attachments/assets/e03a7a7e-5ccc-4b37-9d7a-97d29040e748" />

<img width="1152" height="66" alt="image" src="https://github.com/user-attachments/assets/199965fb-7906-41d0-85bf-ccdef33ceab0" />

### Sending Regexes to Chat

You can send any individual regex to chat by clicking the "Send to chat" button next to each regex. Alternatively, you can click "send all to chat" to send each one individually. This may lead to chat timeouts.

### Phone Number Watching

Furthermore, you can select a phone number to get corresponding number watching/blacklisting commands:

<img width="1378" height="879" alt="image" src="https://github.com/user-attachments/assets/ddff09b5-8982-4da9-bed1-f3ce7bdbb960" />

<img width="1169" height="220" alt="image" src="https://github.com/user-attachments/assets/09a43f7d-ce31-4d2d-94d8-c196a0a71a59" />

### Switching Between Watch and Blacklist

You can also make commands generate as their blacklist counterparts by switching to blacklist mode:

<img width="1372" height="976" alt="image" src="https://github.com/user-attachments/assets/0de35c8c-46d8-47f5-947b-3bc89fdf8ad9" />

### Toggle Whether `-` is Appended to Commands

You can also silence or unsilence commands with the silent switch:

<img width="1371" height="967" alt="image" src="https://github.com/user-attachments/assets/c802061f-6ae5-40ea-93b2-fd4ca6c5460b" />

### Case Insensitive Regexes

Hold shift when clicking the "Generate Regex" button to make plain text commands wrap in `(?i-:)`:

<img width="1221" height="370" alt="image" src="https://github.com/user-attachments/assets/34c49447-cf8e-431d-ae18-f061262c7cb5" />

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

