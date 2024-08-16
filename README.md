# WatchScribe
A handy dandy tool to generate regexes for smokey to watch

_Very much in development._

## How to Use

When in CHQ normally, selecting any text and clicking the "Generate Regexes" button will put regex(es) for watching the selected text under the info links:

![image](https://github.com/user-attachments/assets/506f8ca6-f55d-48d9-b1db-224f52bb7720)

When viewing a report using FIRE, the option will be at the bottom of the report:

![image](https://github.com/user-attachments/assets/de6235b8-89af-4958-9225-27d5cca91433)

To aid with the selection of links in text, `<a>` tags are made unclickable. This is so you can actually select them without going to the address.

Copy-paste the commands into the chat box and send to watch the regex. Only send one at a time.

## Eventual Goals

These are goals that will be implemented over time in no particular order.

- ~~Make it so that regexes can be automatically sent from a button click (e.g. a button next to each regex saying "Send to Chat")~~ [Implemented]
- Add an option to switch between Watch/Blacklist
- Suggest possible words/phrases to watch
- Add phone number handling
- Utilise data from the report (e.g. know which domains have already been watched)
- Make it so that links can be selected + hovered (will require borrowing code from FIRE)

