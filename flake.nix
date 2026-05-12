{
  description = "Strava Overlay Studio — reproducible dev environment (Node 20 + pnpm + process-compose)";

  inputs = {
    # Pin to nixos-unstable for a recent Node/pnpm/process-compose. Bump
    # this via `nix flake update` when you want newer pkgs; the lockfile
    # makes the choice reproducible across machines.
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Single source of truth for the Node major. Bump in lockstep with
        # .nvmrc when migrating runtimes.
        nodejs = pkgs.nodejs_20;

        # Convenience launcher: `nix run` (or `nix run .#dev`) spawns
        # process-compose against ./process-compose.yaml — the four-process
        # local stack (3 Vite apps + the auth worker). Equivalent to running
        # `process-compose` from inside `nix develop`.
        devScript = pkgs.writeShellApplication {
          name = "strava-overlay-dev";
          runtimeInputs = [ pkgs.process-compose ];
          text = ''
            exec process-compose --config "${./process-compose.yaml}"
          '';
        };
      in {
        devShells.default = pkgs.mkShell {
          name = "strava-overlay-studio";

          packages = [
            nodejs
            pkgs.pnpm           # workspace package manager
            pkgs.process-compose # orchestrates the 4 dev processes
            pkgs.git
            pkgs.jq             # JSON munging in shell scripts
            pkgs.gh             # GitHub CLI — handy but not required
          ];

          shellHook = ''
            # Quiet the npm update banner; we pin versions deliberately.
            export NPM_CONFIG_UPDATE_NOTIFIER=false
            # Wrangler telemetry opt-out (matches what CI does).
            export DO_NOT_TRACK=1

            echo ""
            echo "🏃  Strava Overlay Studio — dev shell"
            echo "    node $(node --version) · pnpm $(pnpm --version) · process-compose $(process-compose version 2>&1 | head -1 | awk '{print $NF}')"
            echo ""
            if [ ! -d node_modules ]; then
              echo "First time? Run:  pnpm install"
            fi
            if [ ! -f apps/shell/.env.local ]; then
              echo "Shell needs env vars:  cp apps/shell/.env.example apps/shell/.env.local  (then fill in)"
            fi
            if [ ! -f auth-worker/.dev.vars ] && [ -f auth-worker/.dev.vars.example ]; then
              echo "Worker needs secrets:  cp auth-worker/.dev.vars.example auth-worker/.dev.vars  (then fill in)"
            fi
            echo ""
            echo "Start everything (3 Vite apps + worker) with one command:"
            echo "    process-compose            # TUI dashboard, ports 3000/3001/3002/8787"
            echo "Or equivalently from outside the shell:"
            echo "    nix run"
            echo ""
            echo "Per-process (no TUI):"
            echo "    pnpm dev:shell · pnpm dev:editor · pnpm dev:history"
            echo "    (cd auth-worker && npx wrangler dev)"
            echo ""
          '';
        };

        # `nix run` and `nix run .#dev` both spin up the full stack via
        # process-compose. `nix run .#shell` etc would be additions if we
        # ever want per-app entry points — for now the orchestrator is the
        # only thing that benefits from a flake entry point.
        packages = {
          default = devScript;
          dev = devScript;
        };

      });
}
