# Intellegam — Agent Plugins (Business)

Plugin marketplace for Claude (Claude Code / Cowork) with Intellegam's business
automations. The marketplace manifest is `.claude-plugin/marketplace.json`;
each plugin lives under `plugins/<name>/` with its own `.claude-plugin/plugin.json`.

## Install

```
/plugin marketplace add Intellegam/agent-plugins-business
/plugin install ifm-reporting@intellegam-business
```

## Plugins

| Plugin | Version | Description |
|---|---|---|
| [`ifm-reporting`](plugins/ifm-reporting/) | 0.1.0 | Monthly SSM quotes report + insights, half-yearly SSM subscriber analysis, SST client KPI reports and the monthly SST Action Briefing for IFM Europe / Infomedia. |

## Public repository — data policy

This repository is public. Plugins must not contain personal data (contact
names, e-mail addresses), client financials, dealer identities or partner
subscriber data. Such inputs are kept in private companion files that each
skill documents under "Private data"; example/placeholder versions ship in
the repository so the structure stays runnable. Review every pull request
against this rule before merging.

## Contributing

One branch per plugin change, pull request against `main`, review by the
repository maintainers. Bump the plugin `version` (semver) and the
marketplace `metadata.version` when a plugin changes.
