# Indian Cricket — Beyond the Scoreboard

A single-page Test cricket explorer built around India: player matchups ball by ball,
country matchups, player careers and ground analysis.

The site is one self-contained HTML file. There is no server and no database to run.

## It rebuilds itself

`.github/workflows/daily.yml` runs every morning. It downloads the latest matches,
rebuilds the data file, checks the numbers, builds the page and publishes it to
GitHub Pages. Nothing to do by hand.

You can also run it on demand from the **Actions** tab.

## Where the data comes from

- **Cricsheet** (cricsheet.org) for ball-by-ball data, December 2001 onwards. ODC-By 1.0.
- **A public Test scorecard dataset** compiled from ESPNcricinfo records, for every Test
  from 1877 to December 2023.

Neither is stored in this repository. The daily job downloads both each time it runs.

Every Test ever played is in the database. How much of a player it keeps depends on
whether he is still playing:

- **India's players** - complete careers, because every Test India has played is here.
- **Anyone who has played a Test in the last three years** - complete careers too, every
  opponent. The window is `CURRENT_WINDOW_DAYS` in `refresh/india.mjs`, measured back
  from the newest Test in the data, so it moves forward on its own.
- **Everyone else** - their Tests against India only.

## Running it yourself

```
npm install
node refresh/refresh.mjs    # downloads data, rebuilds app/indiaData.ts
node build.mjs              # writes dist/index.html
```

The history CSVs need to be in `data/history/` first; the workflow file shows where
they come from.
