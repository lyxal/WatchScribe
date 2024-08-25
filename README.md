# WatchScribe
A handy dandy tool to generate regexes for smokey to watch.

Requires [FIRE](https://github.com/Charcoal-SE/userscripts/tree/master/fire) for optimal benefit.

_Very much in development._

## How to Use

When viewing a report with FIRE, the WatchScribe widget will be at the bottom of the report:

![image](https://github.com/user-attachments/assets/6330fa35-231a-4d66-9a17-1f99e88e1334)

You can select text and click "Generate Regex" to add a watch command for that text to the regex list:

![image](https://github.com/user-attachments/assets/10b18e53-56d4-41c0-abe6-4aa7fba24dfa)

![image](https://github.com/user-attachments/assets/3314fa02-3dfd-41a1-a211-f5acbc6df99d)

You can also select any part of a link and it will create commands for the link URL and the link text (if it isn't a URL itself):

![image](https://github.com/user-attachments/assets/8c23254e-b195-4cc6-b176-51c688496685)

![image](https://github.com/user-attachments/assets/db6d651e-23c7-4fe9-acd9-121e5221b14d)

Additionally, you can type any keyword you want and click "Add to list":

![image](https://github.com/user-attachments/assets/cabb817a-6625-4559-822c-d7e9ce629527)

![image](https://github.com/user-attachments/assets/c5ccf61e-c316-4381-b553-a4c18f7d6240)

You can send any individual regex to chat by clicking the "Send to chat" button next to each regex. Alternatively, you can click "send all to chat" to send each one individually. This may lead to chat timeouts.

## Eventual Goals

These are goals that will be implemented over time in no particular order.

- ~~Make it so that regexes can be automatically sent from a button click (e.g. a button next to each regex saying "Send to Chat")~~ [Implemented]
- Get more regex tips from other people in CHQ
- Suggest possible words/phrases to watch
- Add phone number handling
- Utilise data from the report (e.g. know which domains have already been watched)
- ~~Make it so that links can be selected + hovered (will require borrowing code from FIRE)~~ [Implemented]
- Highlight _where_ in the post the detected reasons are.
