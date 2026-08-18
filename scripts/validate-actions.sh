#!/usr/bin/env bash
set -euo pipefail

version="1.7.12"
sha256="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"
cache_dir=".tmp/actionlint/${version}"
archive="${cache_dir}/actionlint.tar.gz"
binary="${cache_dir}/actionlint"

mkdir -p "${cache_dir}"
if [[ ! -x "${binary}" ]]; then
  curl --fail --location --silent --show-error --retry 3 \
    "https://github.com/rhysd/actionlint/releases/download/v${version}/actionlint_${version}_linux_amd64.tar.gz" \
    --output "${archive}"
  printf '%s  %s\n' "${sha256}" "${archive}" | sha256sum --check --status
  tar -xzf "${archive}" -C "${cache_dir}" actionlint
  chmod +x "${binary}"
fi

workflows=()
while IFS= read -r -d '' file; do
  workflows+=("${file}")
done < <(find .github/workflows -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) -print0)

fixture=".tmp/validator/generated-project-map.yml"
if [[ -f "${fixture}" ]]; then
  workflows+=("${fixture}")
fi

if (( ${#workflows[@]} == 0 )); then
  echo "No workflow files found for actionlint." >&2
  exit 1
fi

"${binary}" "${workflows[@]}"
echo "actionlint ${version}: ${#workflows[@]} workflow file(s) validated."
