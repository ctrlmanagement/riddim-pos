#!/usr/bin/env python3
"""Generate PDF from RIDDIM POS Terminal Spec markdown."""
import markdown
from weasyprint import HTML

INPUT = "RIDDIM_POS_Terminal_Spec.md"
OUTPUT = "RIDDIM_POS_Terminal_Spec.pdf"

with open(INPUT, "r") as f:
    md_content = f.read()

html_body = markdown.markdown(md_content, extensions=["tables", "fenced_code"])

html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    @page {{
        size: letter;
        margin: 0.75in;
        @bottom-center {{
            content: "RIDDIM POS — Terminal Spec | AG Entertainment | March 2026";
            font-size: 8pt;
            color: #888;
        }}
        @bottom-right {{
            content: "Page " counter(page);
            font-size: 8pt;
            color: #888;
        }}
    }}
    body {{
        font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
        font-size: 10pt;
        line-height: 1.5;
        color: #1a1a1a;
        max-width: 100%;
    }}
    h1 {{
        font-size: 20pt;
        border-bottom: 3px solid #D4A843;
        padding-bottom: 8px;
        margin-top: 0;
        color: #0A0A0A;
    }}
    h2 {{
        font-size: 14pt;
        color: #0A0A0A;
        border-bottom: 1px solid #D4A843;
        padding-bottom: 4px;
        margin-top: 24px;
        page-break-after: avoid;
    }}
    h3 {{
        font-size: 11pt;
        color: #333;
        margin-top: 16px;
        page-break-after: avoid;
    }}
    table {{
        width: 100%;
        border-collapse: collapse;
        margin: 12px 0;
        font-size: 9pt;
    }}
    th {{
        background-color: #0A0A0A;
        color: #F5F0E8;
        padding: 6px 10px;
        text-align: left;
        font-weight: 600;
    }}
    td {{
        padding: 5px 10px;
        border-bottom: 1px solid #ddd;
    }}
    tr:nth-child(even) td {{
        background-color: #f9f7f4;
    }}
    code {{
        background-color: #f4f1ec;
        padding: 1px 4px;
        border-radius: 3px;
        font-family: 'SF Mono', 'Menlo', monospace;
        font-size: 8.5pt;
    }}
    pre {{
        background-color: #0A0A0A;
        color: #F5F0E8;
        padding: 12px 16px;
        border-radius: 6px;
        font-size: 8pt;
        line-height: 1.4;
        overflow-x: auto;
        page-break-inside: avoid;
    }}
    pre code {{
        background: none;
        padding: 0;
        color: #F5F0E8;
    }}
    hr {{
        border: none;
        border-top: 1px solid #D4A843;
        margin: 20px 0;
    }}
    strong {{
        color: #0A0A0A;
    }}
    em {{
        color: #555;
    }}
    ol, ul {{
        padding-left: 20px;
    }}
    li {{
        margin-bottom: 4px;
    }}
</style>
</head>
<body>
{html_body}
</body>
</html>"""

HTML(string=html).write_pdf(OUTPUT)
print(f"PDF generated: {OUTPUT}")
