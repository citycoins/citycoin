#!/usr/bin/bash

script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
contracts_dir_rel="${script_dir}/../contracts"
contracts_dir=$(readlink -e "$contracts_dir_rel")
contracts_clarinet_dir="${contracts_dir}/clarinet"

sip10_address="SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait"
mock_sip10_address="ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.sip-010-trait.sip-010-trait"

rm -rf "${contracts_clarinet_dir}"
mkdir -p "${contracts_clarinet_dir}"

#
shopt -s nullglob
for f in "${contracts_dir}"/*.clar; do 
  filePath=$(readlink -e "$f")
  fileName=$(basename "${filePath}")
  targetFilePath="${contracts_clarinet_dir}/$fileName"

  cp "${filePath}" "${targetFilePath}"

  sed -i -e "s|${sip10_address}|${mock_sip10_address}|g" "${targetFilePath}"
done;
shopt -u nullglob