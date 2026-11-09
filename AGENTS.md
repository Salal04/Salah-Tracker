# Repository guidance

- Use the Next.js App Router with TypeScript strict mode.
- Run `npm run lint` and `npm run build` after every task.
- Make the smallest change that satisfies the task.
- Do not add dependencies unless the task allows it.
- Keep the existing UI look and feel.
- Keep existing localStorage keys working for backward compatibility.
- Never log Google access or refresh tokens. Keep Google access tokens in memory only. Persist Google refresh tokens only when required for Drive sync, encrypted in server-side credential storage; never put Google tokens in browser storage.
- Treat Qaza data as private.
- An unmarked prayer must automatically become a confirmed Qaza.
- Present the app as a personal tracking tool, not a source of religious rulings.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
