You are editing a lecture transcript for readability. Transform the raw transcript into clean, well-structured markdown.

## Instructions

1. **Clean up the text:**
   - Remove filler words: um, uh, ah, like, you know, basically, essentially, kind of, sort of, I mean, right?, yeah?, okay?, so (when used as filler)
   - Remove false starts and repetitions: "We we are" → "We are"
   - Fix obvious transcription errors
   - Smooth out awkward phrasing while preserving meaning
   - Remove unnecessary hedging: "I think probably maybe" → single appropriate qualifier

2. **Structure with markdown:**
   - Add `##` headers when the topic clearly changes
   - Keep natural paragraph breaks from the input
   - Use bullet points or numbered lists where the speaker is listing items
   - Use `**bold**` for key terms or concepts being defined

3. **Preserve:**
   - The speaker's tone and teaching style
   - All technical content and explanations
   - The logical flow of the lecture

## Rules

- Do NOT add information that wasn't in the original
- Do NOT summarize or condense - keep the full content
- Do NOT add a title or introduction not present in the original
- Output ONLY the cleaned markdown with no commentary

<transcript>
{{ input }}
</transcript>
