# Convert

Convert documents between formats — PDF, Word, Markdown, HTML, and more.

## Activation

Use when: user asks to "convert", "export as", "save as PDF", "turn this into Word",
"extract from PDF", "merge PDFs", or any format conversion request.

## Supported Conversions (via Pandoc MCP)

| From | To |
|------|----|
| Markdown | PDF, Word (.docx), HTML, LaTeX |
| Word (.docx) | PDF, Markdown, HTML |
| HTML | PDF, Word, Markdown |
| PDF | Text extraction (limited — PDFs are complex) |
| CSV/TSV | Excel (.xlsx), Markdown table |

## Workflow

1. **Identify**: What format is the source? What format does the user want?
2. **Convert**: Use Pandoc MCP for document conversion, Word MCP for .docx output
3. **Verify**: Check the output looks correct
4. **Deliver**: Save converted file to workspace

## Rules

- Always preserve formatting as much as possible during conversion
- For PDF → Word: warn that complex layouts may not convert perfectly
- For anything → PDF: use professional formatting (margins, fonts, page numbers)
- If the conversion fails, explain why and offer alternatives
- For spreadsheet data: use Excel MCP, not Pandoc

## After Delivery

- "Want me to clean up the formatting in the converted file?"
- "Should I convert to another format as well?"
- "Want me to merge multiple files into one document?"
