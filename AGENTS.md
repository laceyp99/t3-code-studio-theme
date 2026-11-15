# T3 Code Studio Theme

A CSS-only music-studio theme for T3 Code. `studio.css` is the editable stylesheet; `studio.json` is the importable theme with the same CSS embedded.

## After a theme edit request

1. Make the requested changes and sync the full contents of `studio.css` into the `css` field of `studio.json`. Preserve the other theme fields.
2. Verify that the JSON parses, its `css` matches `studio.css` exactly, and the CSS is at most **20,000 characters**. Keep the CSS minified to stay within T3's limit. Run `git diff --check`.
3. Apply the updated theme to the current T3 environment as part of the edit request. Prefer `t3_theme_read` followed by `t3_theme_set` with `themeId: "studio"` and the theme from `studio.json`. If those tools are unavailable, run this from the repository root:

   ```powershell
   t3.cmd theme set .\studio.json --id studio
   ```

   On other platforms, use `t3` instead of `t3.cmd`. This publishes the local theme and switches connected web and desktop clients to it. No manual import or file copy is needed. Do not target a different environment unless asked.
4. Report whether applying succeeded. If the user's local app connects to a separate environment, they can run the same command there with the updated file, or import `studio.json` through **Settings > Appearance > Import theme** and choose **Studio**.

Do not commit unless asked.
