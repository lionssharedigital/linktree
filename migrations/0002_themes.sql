-- Admin-managed, reusable style presets. `config` is a JSON blob with the
-- same shape as a page's own style fields (see src/pages.js THEME_FIELDS) —
-- accent/backgroundColor/sectionColor/contentBoxColor/sharpCorners/
-- avatarStyle/cardStyle/socialIconStyle/fontStack.
CREATE TABLE themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Which theme a page uses, if any. Blank means "no theme — use this page's
-- own style fields exactly as before this migration." Deleting a theme
-- clears theme_id on any pages using it (see db.deleteTheme) rather than
-- relying on a DB-level foreign key action.
ALTER TABLE pages ADD COLUMN theme_id TEXT NOT NULL DEFAULT '';
