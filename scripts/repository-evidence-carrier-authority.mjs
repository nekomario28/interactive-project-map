function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function optionalString(value, label) {
  if (value == null) return null;
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string when present`);
  return value.trim();
}

/**
 * Evaluate whether repository evidence is safe to reuse in the current live
 * portfolio consumer. The current consumer presents repository identity at the
 * repository/default-branch level; it does not expose a branch/PR carrier scope.
 *
 * Cases without explicit carrier metadata preserve the existing bounded-fixture
 * behavior. Once a case declares a carrier, mismatches fail closed.
 */
export function evaluateEvidenceCarrierAuthority(caseValue) {
  const subject = object(caseValue, "evidence case");
  if (subject.carrier == null) {
    return {
      declared: false,
      consumerScope: "repository-default-branch-implicit",
      liveAdmissionAllowed: true,
      reasonCodes: [],
    };
  }

  const carrier = object(subject.carrier, "evidence case carrier");
  const authorityScope = optionalString(carrier.authorityScope, "evidence case carrier.authorityScope");
  const branch = optionalString(carrier.branch, "evidence case carrier.branch");
  const defaultBranch = optionalString(carrier.defaultBranch, "evidence case carrier.defaultBranch");
  const reasonCodes = [];

  if (carrier.authorityMatch === false) reasonCodes.push("explicit-authority-mismatch");
  if (carrier.productionAdmissionEligible === false) reasonCodes.push("production-admission-disabled");
  if (branch && defaultBranch && branch !== defaultBranch) reasonCodes.push("non-default-carrier");
  if (authorityScope && authorityScope !== "repository-default-branch") reasonCodes.push("consumer-does-not-model-carrier-scope");

  // Carrier metadata is an explicit provenance claim. If it exists but does not
  // establish enough information to bind evidence to the consumer-visible
  // default-branch identity, do not silently treat it like an undeclared case.
  if (!authorityScope && !branch && !defaultBranch && carrier.authorityMatch !== true) {
    reasonCodes.push("carrier-authority-unresolved");
  }

  return {
    declared: true,
    consumerScope: "repository-default-branch-implicit",
    authorityScope,
    branch,
    defaultBranch,
    liveAdmissionAllowed: reasonCodes.length === 0,
    reasonCodes: [...new Set(reasonCodes)],
  };
}

export function assertLiveEvidenceCarrierAuthority(caseValue, label = "Quality calibration case") {
  const result = evaluateEvidenceCarrierAuthority(caseValue);
  if (!result.liveAdmissionAllowed) {
    throw new Error(`${label} evidence carrier authority is not compatible with live repository identity: ${result.reasonCodes.join(", ")}`);
  }
  return result;
}
