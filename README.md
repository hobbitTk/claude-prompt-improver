# prompt-improver

A Claude Code mod that makes terse prompts land on the first try.

You type `what does it do?` and Claude already knows what "it" is. You type `make it nicer` and Claude settles what "nicer" means for the thing you were just working on, and asks only when two readings would lead to materially different work.

## How it works

The mod hooks every prompt you type and attaches a short reading rubric **beside** it, as hidden context the model reads after your words. Your prompt enters exactly as typed and wins on any conflict. The rubric asks the model to settle four things before acting:

1. **Goal.** What you most likely want, with every "it", "this", "that" and any elided object resolved against the conversation.
2. **Shape.** What you expect back: an answer in chat, a code change, a file, a decision, or a question.
3. **Implicit constraints.** What you'd assume it already knows: project conventions, decisions made earlier in the session, the language you typed in.
4. **Ambiguity.** At most one real fork in meaning. If it matters, ask instead of guessing.

When the model resolved a pronoun or chose between readings, it opens its reply with one line, `Reading this as: ...`, so you can correct it in your next message. On a clear prompt there is no preamble.

There is **no extra model call**. The model that already holds the conversation does the reading inside the turn it was going to run anyway, so the mod adds no latency and no cost beyond a few hundred tokens of context.

### What it leaves alone

- Slash commands.
- Prompts under 4 words, such as `ok` or `y` (configurable).
- Prompts over 40 words, which are already explicit (configurable).
- Prompts a plugin, a peer session, a scheduled task or a notification submitted, rather than a person.
- Everything, while it is switched off with `/improver off`.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install prompt-improver --marketplace hobbitTk/claude-prompt-improver
```

From a shell:

```
claude plugin install prompt-improver --marketplace hobbitTk/claude-prompt-improver
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `hobbitTk/claude-prompt-improver`, then **Add plugin**.

Answer `y` to add the marketplace, then pick a scope (user scope installs it for every project).

## Use

| Command | Effect |
| --- | --- |
| `/improver` or `/improver status` | Says whether it is on |
| `/improver off` | Stops attaching the rubric for this session |
| `/improver on` | Starts again |

The state is per session; a new session starts with it on.

## Configure

Two fields in the plugin's config menu (`/config`, under the plugin's name):

| Field | Default | Meaning |
| --- | --- | --- |
| Minimum words | 4 | Prompts with fewer words are left alone |
| Maximum words | 40 | Prompts with more words are left alone |

## Develop

```
claude plugin validate .   # manifest and hooks module, as the engine reads them
claude plugin test .       # the test suite under tests/
claude --plugin-dir .      # run a session with the mod loaded from this folder
```

The mod is a single hooks module, `hooks/register.ts`, with one piece of session state (whether it is enabled) declared in `types/index.d.ts`.

## License

MIT
