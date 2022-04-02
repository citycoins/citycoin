# CityCoins <!-- omit in TOC -->

[![Contract Tests](https://github.com/citycoins/citycoin/actions/workflows/test-contract.yaml/badge.svg)](https://github.com/citycoins/citycoin/actions/workflows/test-contract.yaml) [![codecov.io](https://codecov.io/github/citycoins/citycoin/coverage.svg?branch=main)](https://codecov.io/github/citycoins/citycoin?branch=main) [![Discord Chat](https://img.shields.io/discord/856920147381190717?label=Discord)](https://discord.com/invite/tANUVBz9bk)

## Introduction <!-- omit in TOC -->

CityCoins give communities the power to improve and program their cities.

- [Contributing](#contributing)
- [Testing](#testing)
- [Definitions, Resources, and Links](#definitions-resources-and-links)
- [References](#references)

## Contributing

PRs are welcome! Please see the [open issues](https://github.com/citycoins/citycoin/issues) and comment if interested, or submit a PR for review.

All code submitted should be thoroughly commented and tested where applicable.

## Testing

Contracts are tested via [clarinet](https://github.com/hirosystems/clarinet) using typescript.

To test the contract using `clarinet`, first [install the tool](https://github.com/hirosystems/clarinet#installation) to make it available on your system.

Several commands are available to help with testing via `npm`:

- to run the prepare script:
  `npm run clarinet:prepare`
- to run all tests:
  `npm test`, `npm run test`, `npm run clarinet:test`
- to run individual tests:
  `npm run test:auth`
  `npm run test:core`
  `npm run test:token`
- to run specific clarinet functions
  `npm run clarinet:check`
  `npm run clarinet:codecov`
  `npm run console`, `npm run clarinet:console`

A bash script is provided to prepare the tests as part of `clarinet:prepare`, and executes the following steps:

1. copies all contract files from `./contracts` to `./contracts/clarinet`
2. modifies address used in impl-trait by replacing it with a different address. e.g.
   `(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-10-ft-standard.ft-trait)`
   is converted to:
   `(impl-trait 'ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.sip-10-ft-standard.ft-trait)`
3. appends code stored in `./contracts/test_addons` at the end of contract file with the same name
   e.g. `./contracts/test_addons/citycoin-core-v1.clar` is added to `./contracts/citycoin-core-v1.clar`

**Note:** `clarinet:test`, `clarinet:check`, and `clarinet:console` automatically execute `clarinet:prepare`.

## Definitions, Resources, and Links

CityCoins Resources

- [CityCoins Website](https://citycoins.co)
- [CityCoins API](https://api.citycoins.co/docs)
- [CityCoins Documentation](https://docs.citycoins.co)
- [CityCoins Discord](https://chat.citycoins.co)
- [CityCoins Twitter](https://twitter.com/mineCityCoins)

Some quick definitions and additional resources related to the technology behind the project.

- [Stacks Blockchain:](https://stacks.co) Stacks makes Bitcoin programmable, enabling decentralized apps and smart contracts that inherit all of Bitcoin’s powers.
- [Proof of Transfer (PoX):](https://hackernoon.com/wtf-is-proof-of-transfer-and-why-should-anyone-care-wd2330p9) The consensus mechanism for the Stacks blockchain, which the CityCoins protocol is based on.
- [Clarity Language:](https://clarity-lang.org/) A smart contract language developed by Blockstack (now [Hiro](https://hiro.so)) and Algorand, designed to be more safe, secure, and predictable.
- [Smart Contract:](https://en.wikipedia.org/wiki/Smart_contract) A computer program or a transaction protocol which is intended to automatically execute, control or document legally relevant events and actions according to the terms of a contract or an agreement.
- [Fungible Token:](https://github.com/stacksgov/sips/blob/hstove-feat/sip-10-ft/sips/sip-010/sip-010-fungible-token-standard.md) Digital assets that can be sent, received, combined, and divided.

## References

- [Stacks 2.0 Whitepaper](https://gaia.blockstack.org/hub/1AxyPunHHAHiEffXWESKfbvmBpGQv138Fp/stacks.pdf)
- [Clarity Language Reference](https://docs.stacks.co/write-smart-contracts/language-overview)
- [Clarity Function Reference](https://docs.stacks.co/write-smart-contracts/language-functions)
- [Build apps with Stacks](https://docs.stacks.co/build-apps/overview)
