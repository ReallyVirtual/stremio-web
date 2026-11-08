# stremio-web, with three additions

A personal fork of [Stremio/stremio-web](https://github.com/Stremio/stremio-web), rebased onto upstream whenever I find the time.

## What it adds
- **Stream filters.** Hide streams in the list by size, seed count and language.
- **Hide watched.** A Settings option that hides watched items everywhere.
- **Discover "not watched" toggle.** A per-page switch that moves watched titles to the bottom of a catalog (hiding them outright is planned).

## Why a fork
Add-ons can only return their own streams. They can't filter streams that come from other add-ons, so a client-side filter has to live in the web UI. I proposed it upstream in [#1541](https://github.com/Stremio/stremio-web/issues/1541), but it was declined; upstream offers stream filtering as a paid Supporter feature.

## Branches
- `stream-filters`, `hide-watched`, `discover-not-watched`: one feature each, kept on top of upstream `development`.
- `local-build`: all three merged; this is the branch I build and run.

## Build
Same as upstream: `pnpm install && pnpm build`, then serve `build/`.

Licensed GPL-2.0, as upstream (see [LICENSE.md](LICENSE.md)). Changes from upstream are the commits on the branches above.
