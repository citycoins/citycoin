# CityCoins <!-- omit in TOC -->

[![Contract Tests](https://github.com/citycoins/citycoin/actions/workflows/test-contract.yaml/badge.svg)](https://github.com/citycoins/citycoin/actions/workflows/test-contract.yaml) [![codecov.io](https://codecov.io/github/citycoins/citycoin/coverage.svg?branch=main)](https://codecov.io/github/citycoins/citycoin?branch=main) [![Discord Chat](https://img.shields.io/discord/856920147381190717?label=Discord)](https://discord.com/invite/tANUVBz9bk)

## Introduction <!-- omit in TOC -->

CityCoins give communities the power to improve and program their cities.

- [Contributing](#contributing)
- [Testing](#testing)
- [Definitions, Resources, and Links](#definitions-resources-and-links)
  - [CityCoins v1.0.0 Audit](#citycoins-v100-audit)
  - [CityCoins Resources](#citycoins-resources)
  - [Additional Resources](#additional-resources)
- [References](#references)

## Contributing

PRs are welcome! Please see the [open issues](https://github.com/citycoins/citycoin/issues) and comment if interested, or submit a PR for review.

**Note:** All PRs should be opened against the `develop` branch!

All code submitted should be thoroughly commented and tested where applicable.

## Testing

Contracts are tested via [clarinet](https://github.com/hirosystems/clarinet) using a custom typescript implementation.

To test the contract using `clarinet`, first [install the tool](https://github.com/hirosystems/clarinet#installation) to make it available on your system.

After installation, the standard clarinet commands can be used against the root directory, e.g. `clarinet console`.

Several commands are also available to help with testing via `npm`:

- to run all tests:
  - `npm test`
  - `npm run test`
- to run individual tests for cities:
  - `npm run test:mia`
  - `npm run test:nyc`
- to run individual tests by type:
  - `npm run test:cities`
  - `npm run test:base`
  - `npm run test:misc`
- to run more specific tests:
  - `npm run test:mia:auth`
  - `npm run test:nyc:core`
  - `npm run test:base:token`
  - `npm run test:misc:tardis`
  - `npm run test:misc:utils`
  - `npm run test:misc:vote`
- to run specific clarinet functions
  - `npm run clarinet:check`
  - `npm run clarinet:codecov`
  - `npm run clarinet:costs`
  - `npm run console`, `npm run clarinet:console`

## Definitions, Resources, and Links

### CityCoins v1.0.0 Audit

CoinFabrik [completed an audit on v1.0.0 of the protocol](https://blog.coinfabrik.com/smart-contract-en/citycoins-audit/) on March 14, 2022.

The [resulting audit report](./audit/coinfabrik-citycoins-audit-v1.0.0.pdf) is available in this repo, as well as the [CityCoins developer responses](./audit/coinfabrik-citycoins-audit-v1.0.0-developer-responses.pdf).

### CityCoins Resources

- [CityCoins Website](https://citycoins.co)
- [CityCoins API](https://api.citycoins.co/docs)
- [CityCoins Documentation](https://docs.citycoins.co)
- [CityCoins Discord](https://chat.citycoins.co)
- [CityCoins Twitter](https://twitter.com/mineCityCoins)

### Additional Resources

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
