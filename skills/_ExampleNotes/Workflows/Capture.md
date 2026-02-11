# Capture Workflow

Capture a note from the user and persist it.

## Steps

1. **Extract the note content** from the user's message
   - Strip the trigger phrase ("take a note", "remember", etc.)
   - The remaining text is the note content

2. **Generate timestamp**
   ```bash
   date -u +"%Y-%m-%dT%H:%M:%SZ"
   ```

3. **Append to notes file**
   ```bash
   NOTES_FILE="memory/notes.md"

   # Create file if it does not exist
   if [ ! -f "$NOTES_FILE" ]; then
     echo "# Notes" > "$NOTES_FILE"
     echo "" >> "$NOTES_FILE"
   fi

   echo "- [$TIMESTAMP] $NOTE_CONTENT" >> "$NOTES_FILE"
   ```

4. **Confirm to user**
   Respond with: "Note captured: <first 50 chars of note>"

## Inputs

- User's message containing the note

## Output

- Timestamped entry appended to `memory/notes.md`
- Confirmation message to user
