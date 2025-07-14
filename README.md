# WatchScribe

_[Direct Install](https://github.com/lyxal/WatchScribe/raw/refs/heads/main/WatchScribe.user.js)_

---

A handy dandy tool to generate regexes for smokey to watch.

Requires [FIRE](https://github.com/Charcoal-SE/userscripts/tree/master/fire)
to operate.


## How to Use

When viewing a report with FIRE, the WatchScribe widget will be at the bottom of the report:

<img width="1371" height="877" alt="image" src="https://github.com/user-attachments/assets/bc52dfba-f2bb-45d3-87eb-e70fb50c694a" />

You can select text and click "Generate Regex" to add a watch command for that text to the regex list:

<img width="1377" height="877" alt="image" src="https://github.com/user-attachments/assets/cca389fa-4195-4efa-b85d-460f0d4f70c7" />

<img width="1155" height="80" alt="image" src="https://github.com/user-attachments/assets/cfc4fa56-690a-436e-802f-bd4cc673f0e8" />


You can also select any part of a link and it will create commands for the link URL and the link text (if it isn't a URL itself):

<img width="1380" height="946" alt="image" src="https://github.com/user-attachments/assets/ab064297-6eea-4aae-99e4-ac36f542ae14" />


<img width="1164" height="214" alt="image" src="https://github.com/user-attachments/assets/1344e2a7-2256-495c-91b9-7fb27804c4ff" />


Additionally, you can type any keyword you want and click "Add to list":

<img width="1372" height="1146" alt="image" src="https://github.com/user-attachments/assets/e03a7a7e-5ccc-4b37-9d7a-97d29040e748" />

<img width="1152" height="66" alt="image" src="https://github.com/user-attachments/assets/199965fb-7906-41d0-85bf-ccdef33ceab0" />

You can send any individual regex to chat by clicking the "Send to chat" button next to each regex. Alternatively, you can click "send all to chat" to send each one individually. This may lead to chat timeouts.

Furthermore, you can select a phone number to get corresponding number watching/blacklisting commands:

<img width="1378" height="879" alt="image" src="https://github.com/user-attachments/assets/ddff09b5-8982-4da9-bed1-f3ce7bdbb960" />

<img width="1169" height="220" alt="image" src="https://github.com/user-attachments/assets/09a43f7d-ce31-4d2d-94d8-c196a0a71a59" />

You can also make commands generate as their blacklist counterparts by switching to blacklist mode:

<img width="1372" height="976" alt="image" src="https://github.com/user-attachments/assets/0de35c8c-46d8-47f5-947b-3bc89fdf8ad9" />

You can also silence or unsilence commands with the silent switch:

<img width="1371" height="967" alt="image" src="https://github.com/user-attachments/assets/c802061f-6ae5-40ea-93b2-fd4ca6c5460b" />


## Eventual Goals

These are goals that will be implemented over time in no particular order.

- ~~Make it so that regexes can be automatically sent from a button click (e.g. a button next to each regex saying "Send to Chat")~~ [Implemented]
- ~~Get more regex tips from other people in CHQ~~ [Completed]
- Suggest possible words/phrases to watch
- ~~Add phone number handling~~ [Implemented]
- Utilise data from the report (e.g. know which domains have already been watched)
- ~~Make it so that links can be selected + hovered (will require borrowing code from FIRE)~~ [Implemented]
- Highlight _where_ in the post the detected reasons are.
- Allow for a setting to toggle whether commands are silent (ending with `-`) or not (ending with nothing).
