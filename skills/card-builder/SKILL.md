# Card Builder

Build OpenWebUI dashboard cards with matching model configs.

## Activation

Use when: user asks to "build a card", "create a card", "make an OpenWebUI card",
"dashboard card", or describes a tool they want non-technical users to access.

## Output

Every card build produces exactly TWO files:
1. `card.json` — Dashboard UI definition (form fields, prompt template, output formatter, API config, translations)
2. `model.json` — OpenWebUI model config (base model, system prompt, temperature, context window)

Both files go in a `config/` directory within the project.

## Interactive Flow

Run this as a conversation. Do NOT generate both files from a single prompt.

### Phase 1: Purpose
Ask: "What should this card do? Give me a name, one-line description, and category."
- Categories: Productivity, Writing, Analysis, Code, Research, Creative, Operations
- Icon: choose from Lucide icon set (ClipboardCheck, FileText, BarChart3, Code2, Search, Palette, Settings)

### Phase 2: Inputs
Ask: "What information does the user provide?"
- Map each input to a field type: `text`, `textarea`, `file`, `select`
- Each field needs: id, label, placeholder, required (Yes/No)
- File fields also need: maxFiles, fileTextInsert (boolean)
- Select fields also need: options array

### Phase 3: Model & Behaviour
Ask: "What model and temperature? Any special instructions?"
- Default base model: `gemma3:27b`
- Default temperature: 0.7 (creative) or 0.3 (precise)
- Default top_p: 0.9
- Default num_ctx: 32768
- System prompt: generate from the card's purpose. Be prescriptive. Include output structure.

### Phase 4: Output Formatting
Generate a JavaScript `outputFunction` that:
- Parses the model response into structured sections
- Adds visual formatting (headers, dividers, icons)
- Handles edge cases (empty response, malformed data)
- Wraps in try/catch with raw fallback

### Phase 5: Translations
Generate `en` translations for all field labels, placeholders, title, description.
If bilingual, also generate `fr`.

### Phase 6: Generate Files
Write both `config/card.json` and `config/model.json`.
Confirm file locations and show a summary.

## Rules

1. Field IDs use kebab-case: `employee-name`, not `employeeName`
2. The card.json `api.model` field MUST match the model.json `id` field
3. Translation keys follow: `{card-id}.title`, `{card-id}.fields.{field-id}.label`
4. The `promptTemplate` uses `{{field-id}}` placeholders matching form field IDs
5. System prompts are prescriptive — specify exact output structure, not vague guidelines
6. Output functions use vanilla JS (no ES6 imports, no external deps)
7. Always include a disclaimer line in the output function for AI-generated content
8. num_ctx minimum 8192, maximum 131072

## Reference

Load `references/card-example.json` and `references/model-example.json` for the exact JSON structure.
