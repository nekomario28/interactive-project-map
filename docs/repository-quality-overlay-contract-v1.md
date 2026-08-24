# Repository Quality overlay contract v1

Status: **experimental presentation contract / no production viewer integration / no score-based sizing**

Repository Quality remains a component vector with separate Confidence coverage. The presentation problem is to make that evidence readable without inventing a total score merely to drive SVG geometry.

The first visual experiment showed that one ring encoding is not appropriate at every scale. This contract therefore defines two views over the same authoritative Quality/Confidence model:

```text
FULL RING     -> dimension identity / detail / interactive use
COMPACT RING  -> finding distribution / small static summary
```

Neither is a Quality scalar.

## 1. Full ring: fixed dimension identity

The full ring has eight global slots in frozen Quality-dimension order:

```text
0 understandability
1 verification
2 reproducibility
3 maintainability
4 integrity
5 interoperability
6 security-safety
7 stewardship
```

Keeping global slot positions stable lets a detail viewer learn where a dimension lives even when artifact families emphasize different subsets.

Each slot receives a semantic token:

```text
quality-supports
quality-weakens
quality-neutral
quality-mixed
quality-unknown
quality-optional
quality-not-applicable
quality-unresolved-applicability
```

A renderer may map those tokens to theme-native color, dash, thickness, texture, icon or tooltip treatments. The semantic token is the contract; one palette is not.

### Target dimensions

`required` and `recommended` dimensions are targets. Their findings remain visible even when unresolved:

```text
supports  -> known supporting evidence
weakens   -> known weakening evidence
neutral   -> known neutral finding
mixed     -> mixed/conflicting direction
unknown   -> applicable but not directionally resolved
```

An unknown target must not disappear.

### Optional dimensions

Optional dimensions remain addressable in the global full-ring slots but do not increase core Confidence coverage.

### Not applicable

`not-applicable` uses a gap semantic in the full ring. A gap is not zero Quality, unknown evidence, failure or neutral evidence. N/A leaves the target set, so the Confidence denominator changes.

### Unknown applicability

Unknown applicability has a separate token from unknown finding. The evaluator does not yet know whether the dimension belongs in the contract at all.

## 2. Compact ring: target finding distribution

At small profile/README scale the eight dimension identities are not reliably readable. The compact ring therefore summarizes the **distribution of findings across applicable target dimensions**.

Its denominator is:

```text
required + recommended target dimensions
```

and it preserves counts/ratios for:

```text
supports
neutral
weakens
mixed
unknown
```

For example:

```text
interactive-project-map application
  supports 4 / 6
  unknown  2 / 6

ProjExD_Group10 application
  supports 2 / 6
  weakens  1 / 6
  unknown  3 / 6

FiveThirtyEight dataset slice
  supports 4 / 5
  unknown  1 / 5
```

The compact ring intentionally does **not** preserve which named dimension produced each segment. Its model says:

```text
dimensionIdentityPreserved = false
requiresDetailForDimensionIdentity = true
```

Therefore a compact ring must link or expand to a full ring/detail view whenever the user needs the underlying dimensions.

Optional evidence does not enter the compact denominator. N/A also does not enter it. Unknown target findings remain visible as unresolved share.

The compact distribution is not a score: a ring with mostly support communicates evidence direction and coverage composition, not an intrinsic numeric Quality grade.

## 3. Confidence remains separate

The overlay reports:

```text
targetDimensions
directionalDimensions
inspectedDimensions
directionalCoverageRatio
inspectedCoverageRatio
```

and may show a compact label such as:

```text
4/6 interpreted
```

This is an evidence-coverage statement, not a merit multiplier.

Do not multiply Confidence into Quality merely to make one number. Doing so would turn unknown evidence into a Quality penalty.

## 4. Attention state

A small semantic summary may help a tooltip/detail panel explain the most important condition first:

```text
mixed-evidence
weakening-evidence
incomplete-evidence
all-targets-support
known-tradeoff
```

This is explanation priority, not rank or tier.

## 5. What the overlay must not change

Neither full nor compact Quality presentation has authority to modify:

```text
node size
label priority
orbit/radial position
category membership
Impact halo
Portfolio Prominence
```

Those presentation decisions require a separate calibrated contract.

## 6. Cross-artifact behavior

### Application

The frozen `interactive-project-map` application calibration yields:

```text
targets      6
interpreted  4
supports     4
unknown      2
attention    incomplete-evidence
```

The full ring says which dimensions are known/unknown. The compact ring says that 4/6 targets support and 2/6 remain unresolved.

### Application with weakening evidence

`ProjExD_Group10` has direct weakening Stewardship evidence because its public repository has no declared license.

The full ring assigns `quality-weakens` to Stewardship. The compact ring exposes one weakening share among six targets. Neither shrinks the node.

### Dataset

The external dataset calibration targets:

```text
understandability  supports
reproducibility    supports
integrity          unknown
interoperability   supports
stewardship        supports
```

Verification, Maintainability and Security/Safety are optional in that route. The full ring retains all eight global positions; the compact ring summarizes only the five applicable targets.

## 7. N/A and mixed examples

If Security/Safety is explicitly N/A for an application:

```text
full ring
  security-safety = quality-not-applicable gap

compact ring
  security-safety excluded from denominator
  denominator 6 -> 5
```

No synthetic zero is inserted.

If Verification contains both supporting and weakening evidence:

```text
findingState = mixed
full token   = quality-mixed
compact      = mixed share
attention    = mixed-evidence
```

`mixed` must never reuse `neutral` semantics.

## 8. Scale experiment result

A bounded local reconstruction of the checked ring geometry was inspected at 100%, 50% and 33% scale.

Observed behavior:

- full ring at 100%: dimension-level pattern is readable;
- full ring at 50%: supports/weakens remain clear, but unknown/optional/N/A distinctions weaken;
- full ring at 33%: broad direction remains visible, but dimension identity is no longer self-explanatory;
- compact ring at 50% and 33%: support/weakening/unresolved proportions remain materially clearer because optional/N/A dimension-slot detail is intentionally omitted.

This is visual experiment evidence, not production acceptance. It supports **separating full and compact encodings** rather than forcing one eight-slot representation into every scale.

## 9. Why equal node sizing comes first

The product may later rank repositories or give major work more visual prominence. That remains a valid goal, but intrinsic Quality is not yet a safe scalar for geometry.

Portfolio Prominence may eventually combine calibrated signals such as Quality evidence/profile, Impact, Maturity, Scale, Activity context, Personal Contribution and distinctiveness/category coverage. That must remain a separate presentation model.

## 10. Integration boundary

Current implementation is pure experimental code:

```text
buildQualityOverlayModel(policy, qualityVector, confidenceVector)
renderQualityOverlayPrototypeSvg(items, { ringMode: "full" | "compact" })
```

It does not fetch GitHub data, modify `graph.json`, change Action output, add production `quality.json`, touch the twelve renderers, or alter stable-v1.

## Next rendering gate

Before production integration:

1. exact-head CI must pass the full/compact semantic regressions;
2. generate actual full and compact fixture SVG artifacts from the tested head;
3. inspect dark/light themes and realistic GitHub profile sizes;
4. check non-color differentiation and accessibility;
5. decide where the compact ring links/expands to the full dimension detail;
6. only then consider a non-production Quality view or separate `quality.json` artifact.

If compact/full vector presentation proves sufficient, there is no requirement to invent a universal Quality scalar.