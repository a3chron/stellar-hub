{
  description = "Stellar Hub - Next.js development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # nix develop drops into this bash; the default stdenv one has no
            # readline, which breaks interactive prompts (literal \[ \] from
            # starship) and completion (`shopt: progcomp: invalid shell option`).
            bashInteractive

            # Node.js and pnpm
            nodejs_22
            pnpm

            # Sharp dependencies (image processing)
            # These are required for sharp to work properly
            vips
            pkg-config

            # Database tools
            #postgresql

            # Optional: useful dev tools
            nodePackages.typescript
            nodePackages.typescript-language-server
          ];

          # Environment variables for sharp
          shellHook = ''
            # stdenv points SHELL at its readline-less bash; anything spawning
            # $SHELL (e.g. `stellar preview`) should get the interactive one.
            export SHELL="${pkgs.bashInteractive}/bin/bash"
            echo "✳ Stellar Hub development environment loaded"
          '';
        };
      }
    );
}