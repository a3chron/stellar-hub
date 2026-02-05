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
            echo "✳ Stellar Hub development environment loaded"
          '';
        };
      }
    );
}