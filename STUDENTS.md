# Getting Started (for Students)

This is a short guide to running **Actual Budget** on your own computer so you
can explore and experiment with it. Everything runs locally in your browser.

> Already comfortable with Node projects? The whole thing is:
> `git clone … && cd actual && yarn install && yarn start`, then open
> <http://localhost:3001> and click **View demo**.

---

## 1. Prerequisites

Install these once before you start:

| Tool                           | Version         | Notes                                                                                                    |
| ------------------------------ | --------------- | -------------------------------------------------------------------------------------------------------- |
| [Node.js](https://nodejs.org/) | **22 or newer** | Check with `node -v`                                                                                     |
| [Yarn](https://yarnpkg.com/)   | **4.9.1+**      | Comes with Node via Corepack — see below                                                                 |
| [Git](https://git-scm.com/)    | any recent      | On **Windows**, install "Git for Windows" — it also provides the `sh` and `bash` shells some scripts use |

> 💡 **New to Yarn workspaces?** Actual Budget uses [Yarn workspaces](https://yarnpkg.com/features/workspaces) to manage multiple packages in a single repo. You mostly run commands from the root — but understanding workspaces helps when something goes wrong in a sub-package.

> 📖 **Architecture overview:** Before diving in, read the [Contributing guide](https://actualbudget.org/docs/contributing/) — it walks through how the codebase is organized and how the sync server, web app, and shared packages relate to each other.

Enable the correct Yarn version (only needed once):

```bash
corepack enable
```

Yarn will then automatically use the version this project expects.

---

## 2. Install dependencies

Clone the project and install everything. `yarn install` downloads all the
dependencies into a local `node_modules` folder (which is **not** stored in Git —
that's why you install it yourself).

```bash
git clone <repository-url>
cd actual

yarn install
```

> ⚠️ Always run `yarn` commands from the **project root** (the folder with this
> file in it), never from inside a `packages/…` subfolder.

---

## 3. Run the app

```bash
yarn start
```

This starts the development server. When it's ready, open:

**<http://localhost:3001>**

(The browser may open automatically.)

On the welcome screen:

1. Choose **"Don't use a server"** (you don't need one to explore).
2. Click **"View demo"**.

This creates a sample budget filled with realistic data — several accounts,
hundreds of transactions, categories, schedules, and budgeted amounts — so you
have plenty to play with. The demo data is generated fresh each time and lives
only in your browser, so feel free to change or delete anything: click **View
demo** again for a clean slate.

To stop the server, press `Ctrl + C` in the terminal.

---

## 4. Optional: run with the sync server

You only need this if you want to explore multi-device syncing. It starts the
sync server (port 5006) and the web app together:

```bash
yarn start:server-dev
```

For simply learning and experimenting, `yarn start` is enough.

---

## 5. Useful commands

Run all of these from the project root:

| Command          | What it does                                 |
| ---------------- | -------------------------------------------- |
| `yarn start`     | Start the app in your browser (main command) |
| `yarn test`      | Run the test suite across all packages       |
| `yarn typecheck` | Check for TypeScript errors                  |
| `yarn lint`      | Check code style and formatting              |
| `yarn lint:fix`  | Auto-fix style and formatting issues         |

If you change code, `yarn typecheck`, `yarn lint`, and `yarn test` are the three
commands that tell you everything is still healthy.

---

## 6. Troubleshooting

**`node -v` shows a version below 22**
Install Node 22+ from <https://nodejs.org/>. If you use `nvm`, run `nvm use` in
the project folder (it reads the `.nvmrc` file).

**`yarn` isn't found or uses the wrong version**
Run `corepack enable`, then try again. It sets up the exact Yarn version this
project needs.

**Port 3001 is already in use**
Another copy of the app is probably still running. Close it, or the app will
offer to start on a different port (e.g. 3002) — just open that URL instead.

**The page fails to load with `ERR_INSUFFICIENT_RESOURCES`**
This can happen on low-memory machines with the dev server. Build the app once
and it will run more lightly:

```bash
yarn build:browser
```

**Windows: a command fails with `'sh' is not recognized`**
Some build scripts are shell scripts. The everyday commands (`yarn start`,
`yarn start:server-dev`, `yarn test`, `yarn typecheck`, `yarn lint`) work
directly in PowerShell or Command Prompt. If you hit this on another command,
run it from the **Git Bash** terminal that ships with Git for Windows.

---

## 7. Learn more

- Actual Budget documentation: <https://actualbudget.org/docs>
- Envelope budgeting basics: <https://actualbudget.org/docs/getting-started/envelope-budgeting>
- Community Discord: <https://discord.gg/pRYNYr4W5A>

---

---

## Contributing workflow

All team members have write access to this repository, so the team uses a **branch-based** workflow — not forks. Here is the background and the commands.

**Why not forks?** Forking is the standard model for contributing to open-source projects where you _don't_ have write access: you fork to your own GitHub account, clone your fork, and open a PR from your fork back to the original. You will encounter this when contributing to the upstream project. But for your course team — where everyone has write access to the shared repo — it just adds confusion: two clones on your machine, two remotes to keep in sync, merge conflicts that are harder to reason about.

**Branch-based workflow** is what most professional teams use internally. You clone the shared repo once, create a short-lived branch for each issue, push the branch back to the same repo, and open a PR from that branch into `main`. One clone, one remote, full PR workflow.

### For each issue you work on

```bash
# One-time setup: clone the team repo (skip if already done)
git clone https://github.com/CSCI-435-SE/actual-budget.git
cd actual-budget

# Before starting each issue: make sure you are on a fresh main
git checkout main
git pull origin main

# Create a branch named for the issue
git checkout -b feat/issue-17-dark-mode      # new feature
git checkout -b fix/issue-42-toast-dismiss   # bug fix

# ... make your changes, run tests ...

# Stage and commit
git add <the files you changed>
git commit -m "feat: add dark mode toggle (#17)"

# Push the branch to the team repo
git push origin feat/issue-17-dark-mode
```

After pushing, GitHub shows a **"Compare & pull request"** banner on the repository page. Click it to open a PR from your branch into `main`. Fill in the description (what changed and why), reference the issue (`Closes #17`), and request a review from a teammate.

**Branch naming:**

| Prefix                             | Use for                          |
| ---------------------------------- | -------------------------------- |
| `feat/issue-<N>-short-description` | new features                     |
| `fix/issue-<N>-short-description`  | bug fixes                        |
| `chore/short-description`          | docs, config, dependency updates |

> ⚠️ **`main` is protected — direct pushes are blocked.** All changes go through a reviewed PR. If you accidentally commit to `main` locally, move your changes to a branch before pushing:
>
> ```bash
> git checkout -b fix/issue-42-my-fix   # create branch from your current state
> git checkout main
> git reset --hard origin/main          # revert local main to match remote
> ```

**After your PR is merged**, delete the branch to keep the repo tidy:

```bash
git checkout main
git pull origin main
git branch -d feat/issue-17-dark-mode
```

## 8. Project documentation & policies (required reading)

📚 **Official documentation:** <https://actualbudget.org/docs> — start with
[Getting Started](https://actualbudget.org/docs/getting-started/envelope-budgeting).

Actual has its own established contribution processes. They are **not restated here** — you are
responsible for finding, reading, and following them from the sources below:

| You must take care of                  | Where to find it                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| How to use the tool                    | <https://actualbudget.org/docs>                                                                                           |
| Code review process                    | [CODE_REVIEW_GUIDELINES.md](CODE_REVIEW_GUIDELINES.md) + [Contributing docs](https://actualbudget.org/docs/contributing/) |
| Bug / issue resolution process         | [Contributing docs](https://actualbudget.org/docs/contributing/)                                                          |
| Pull request conventions & PR policies | [CONTRIBUTING.md](CONTRIBUTING.md) + [PR and Commit Rules](.github/agents/pr-and-commit-rules.md)                         |
| AI policies                            | [AI Usage Policy](https://actualbudget.org/docs/contributing/ai-usage-policy) + [AGENTS.md](AGENTS.md)                    |

## 9. CI in our fork

Our GitHub Actions workflows (`.github/workflows/`) come from upstream. Upstream runs them on
**Depot**, a paid runner service (`runs-on: depot-ubuntu-latest`). We don't have Depot, so a job
that asks for a `depot-*` runner waits in the queue until GitHub cancels it, about 24 hours later
(issue #101). Our fork changes that in three ways:

- **Checks that run on our PRs use GitHub's free runners** (`ubuntu-latest`). That covers Test
  (lint, typecheck, unit tests), Build, E2E and visual regression tests, the API browser test, and
  the Linux Electron build. The macOS and Windows builds are turned off.
- **Upstream-only workflows are turned off** with `if: github.repository == 'actualbudget/actual'`
  on each job. They show as "skipped" here. These are publishing and releases (npm, Docker,
  Netlify, Flathub, Microsoft Store, nightly desktop app), the stale-PR closer, autofix.ci, the
  release-notes check, `/update-vrt`, the issue bots that point at upstream, and the bot that
  labels `[AI]` PRs (we review AI-generated PRs by hand).
- **The `Fork CI guard` check** runs `.github/scripts/fork-ci-runners.mjs` on every PR. It fails
  if any job that can run here still asks for a Depot runner.

**A red check doesn't block merging.** No check is marked "required", so you can merge a PR with
a failing check and fix the problem in a later PR. Before you merge, compare the PR's failing
checks with `master`'s. If they're the same failures, your PR didn't break anything new.

### After merging an upstream release

Upstream edits can bring Depot runners back, either in a merge conflict or silently in a new job.

1. In a merge conflict on a `runs-on:`/`runner:` line or a guard `if:` line, **keep our version**.
2. Run the checker and let it swap any new Linux Depot labels to GitHub's Linux runners:

   ```bash
   node .github/scripts/fork-ci-runners.mjs --fix
   node .github/scripts/fork-ci-runners.mjs   # should print "No unguarded Depot runner labels found."
   ```

3. If it still reports a **macOS or Windows** label, `--fix` deliberately left it alone, because we
   run CI on Linux only. Remove that entry from the job's matrix, or turn off the whole job (step 4).
4. If upstream added a new workflow that **publishes or releases** something, don't swap its
   runner. Add `if: github.repository == 'actualbudget/actual'` to each of its jobs instead, so it
   never runs here.

Happy budgeting! 🎉
