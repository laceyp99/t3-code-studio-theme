# T3 Code Studio Theme

A CSS-only music-studio theme for T3 Code. `studio.css` is the editable stylesheet; `studio.json` is the importable theme with the same CSS embedded.

## After a theme edit request

1. Make the requested changes to `studio.css`, then run `node scripts/apply-theme.mjs --no-apply`. It syncs the CSS into the `css` field of `studio.json` (preserving the other fields), checks that the JSON parses, and fails if the CSS exceeds **20,000 characters**. Keep the CSS minified to stay within T3's limit.
2. Run `git diff --check`.
3. Apply the updated theme to the current T3 environment as part of the edit request. Prefer `t3_theme_read` followed by `t3_theme_set` with `themeId: "studio"` and the theme from `studio.json`. If those tools are unavailable, run this from the repository root:

   ```powershell
   node scripts/apply-theme.mjs
   ```

   It runs `t3 theme set studio.json --id studio` (`t3.cmd` on Windows), which publishes the local theme and switches connected web and desktop clients to it. No manual import or file copy is needed. Do not target a different environment unless asked.
4. Report whether applying succeeded. If the user's local app connects to a separate environment, they can run the same command there with the updated file, or import `studio.json` through **Settings > Appearance > Import theme** and choose **Studio**.

Do not commit unless asked.
