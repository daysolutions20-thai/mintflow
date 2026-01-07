/* ===== MintFlow QR: align FOR + Note headers and match box heights ===== */

/* Make two-column rows align to the top (no vertical drift) */
.grid.grid-2{
  align-items: start !important;
}

/* Ensure fields in grid behave consistently */
.grid.grid-2 > .field{
  display: flex !important;
  flex-direction: column !important;
}

/* Normalize label spacing so FOR and Note start at the same baseline */
.field > label{
  margin: 0 0 6px 0 !important;
  line-height: 1.15 !important;
}

/* Match the Note box height to the FOR block height */
.field.note-field{
  height: 100% !important;
}

.field.note-field textarea{
  flex: 1 1 auto !important;
  min-height: 136px !important; /* fallback if left side gets shorter */
  height: 100% !important;
  resize: vertical;
}

/* If your Note field does NOT already have .note-field class,
   add this small selector to catch the QR Note block by label text structure */
.field:has(> label + .sub) textarea{
  flex: 1 1 auto !important;
}
