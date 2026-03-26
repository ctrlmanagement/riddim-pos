#!/bin/bash
# RIDDIM POS build — concatenate CSS partials for production
# No npm, no webpack. Just cat.

set -e

echo "Building RIDDIM POS..."

CSS_DIR="terminal/css"
OUT="$CSS_DIR/terminal.built.css"

echo "/* RIDDIM POS Terminal — Built $(date +%Y-%m-%d) */" > "$OUT"

# Parse @import lines from terminal.css, resolve paths, concatenate
while IFS= read -r line; do
  if [[ "$line" =~ @import\ \'(.+)\'\; ]]; then
    PARTIAL="${BASH_REMATCH[1]}"
    # Resolve relative path from css/ directory
    RESOLVED="$CSS_DIR/$PARTIAL"
    if [ -f "$RESOLVED" ]; then
      echo "" >> "$OUT"
      echo "/* --- $PARTIAL --- */" >> "$OUT"
      cat "$RESOLVED" >> "$OUT"
    else
      echo "WARNING: $RESOLVED not found"
    fi
  fi
done < "$CSS_DIR/terminal.css"

LINES=$(wc -l < "$OUT" | tr -d ' ')
echo "CSS built: $LINES lines -> $OUT"
echo "Done."
