# tools

Command-line runners for the simulator. They are used by `bin/apx-sim.mjs`.
Part of the [simulator](../README.md).

- `replay.mjs`: replays the vetting suite (`docs/scenarios/by-module/<module>/scenarios.md`) against the simulator and reports, for each exchange, the status, whether the body validates against the bundle, and for refusals the problem type.
- `script.mjs`: runs a scripted scenario, a JSON file of steps, against the simulator in-process or against a running server with `--url`. The step format is in `src/kernel/scenario.mjs`.
- `directions/`: one JSON file per module. Each holds the stage directions for the replay: world events the scenario text describes but no request performs, such as a gate faulting or a day passing.
