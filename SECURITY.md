# Security Policy

## Scope

`cf` is a local development tool. The web workbench binds to `localhost` and
compiles and executes C++ that you type into it with your own user account;
it is not designed to be exposed to untrusted users or the public internet.
Within that model the following protections are in place:

- Compiler flags supplied from the browser are validated against an
  allowlist; flags that write files, add search paths, load plugins or pass
  through to the linker are rejected and reported (`web/app/api/_engine/flags.ts`).
- The `/api/solution` and `/api/problem-text` routes accept only a single
  safe path segment as the problem name, so requests cannot read or write
  outside the problems directory.
- Sources, stdin and captured output are size-capped, compilation and
  execution are time-limited, and every build runs in its own temporary
  directory.
- The problem store writes atomically and never evaluates stored content.

Do not run the workbench on a shared host or reverse-proxy it to the
internet; the programs it runs are not sandboxed beyond the operating
system's normal process isolation.

## Supported versions

Only the latest release receives fixes.

| Version | Supported |
| ------- | --------- |
| 1.x     | yes       |
| < 1.0   | no        |

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's
private vulnerability reporting on this repository
(**Security -> Report a vulnerability**) so the report stays confidential
until a fix is available. Include the version (`cf version` or the Settings
Server block), the platform, and steps to reproduce.

Reports are acknowledged within a few days, and a fix or mitigation is
released as soon as one is ready.
