# Taxonomy artifact identity boundary — 2026-08-26

Status: **regression fix / no category-policy change / no Quality admission**

## Problem

Artifact facet inference previously searched the whole repository text, including the README, for the word `documentation`. Because artifact selection is an `else if` chain, any executable project whose README contained a documentation section could be classified as `artifact:documentation` before reaching the `artifact:application` fallback.

The current profile exposed this with `nekomario28/lime_tidyup`: its repository identity and README describe a runnable ROS 2 / Gazebo application demo, but the README also contains a mechanism-documentation section. The production graph therefore carried `artifact:documentation`.

## Boundary

Primary category discovery and all non-artifact facets still use the full bounded repository text, including README evidence.

Only `artifact:documentation` identity is narrowed. Documentation is now selected when repository identity metadata — name, description, topics, frameworks, manifests, or prior classification metadata — identifies the repository as documentation. Incidental prose inside an executable project's README no longer changes the artifact kind by itself.

This preserves docs-oriented repositories while avoiding the perverse incentive where better README documentation makes an application look like a documentation artifact.

## Regression gate

A paired runtime test requires:

- an executable ROS 2 / Gazebo demo whose README contains a documentation section remains `artifact:application`;
- a repository whose name/description explicitly identifies a documentation site remains `artifact:documentation`;
- Action JavaScript and hosted TypeScript taxonomy runtimes produce identical results.

## Non-goals

- no primary taxonomy category changes;
- no Quality finding, scoring, ranking, prominence, or Structure authority changes;
- no live Quality source admission;
- no stable `v1` promotion in this patch;
- no profile artifact regeneration until the exact producer head passes the full repository gate and the actual production producer path is separately verified.
