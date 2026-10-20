# Supported runtime policy

Node.js 24.21.0 is the tested contributor/CI baseline, pinned in `.nvmrc`.
The package engines permit stable Node 24 releases at or above 24.21.0 and require
npm 10.9.4; other majors and older releases fail installation early.
This support policy is not a claim that every future patch has already been tested.

The official [Node lifecycle table](https://nodejs.org/en/about/previous-releases)
lists Node 24 as LTS and Node 20 as EOL. The release was verified against the
publisher's SHA256 manifest before local validation. CI reads `.nvmrc`, then
installs the pinned package manager. The contributor prerequisites and engine
metadata use the same selection. `engine-strict=true` gives native npm checks;
the existing preinstall guard additionally explains how to bootstrap.

Install the Node version in `.nvmrc` using your platform's supported installation
method, then run:

```sh
npx --yes npm@10.9.4 ci
npm run build
npm run test:coverage
```

If your installed npm differs, use the pinned npx command for subsequent npm
scripts too, or install npm 10.9.4 explicitly. Node's bundled npm version is not
the project package-manager pin. Installation checks also run when dependencies are already present. Individual
manual scripts do not independently enforce the installation policy; use the
supported tools for those commands.

k6 remains 2.0.0 and uses its own embedded runtime; the owned target's Bun 1.2.15
and the custom k6 image's pinned Go/Alpine build are separate tools. This change
does not regenerate workloads, baseline values, latency thresholds or target images.
Runtime changes to those tools require independent compatibility/measurement work.

When adopting a security patch, verify the official release and checksum, update
`.nvmrc` plus the matching engines/minimum policy, run normal frozen installation
and the relevant build/unit/transport checks, and inspect exact-revision CI.
Retain the previous measured evidence with its original runtime rather than
relabeling it. Review lifecycle status during maintenance before choosing another
major; a new major is not supported merely because it satisfies dependency ranges.
