#!/bin/sh
#set -o errexit -o nounset -o pipefail

PASSWORD=13372828
STAKE=stake
FEE=${FEE_TOKEN:-ucosm}
CHAIN_ID=test
MONIKER=node01

wasmd init --chain-id "$CHAIN_ID" "$MONIKER"
# staking/governance token is hardcoded in config, change this
sed -i "s/\"stake\"/\"$STAKE\"/" "$HOME"/.wasmd/config/genesis.json
# this is essential for sub-1s block times (or header times go crazy)
sed -i 's/"time_iota_ms": "1000"/"time_iota_ms": "10"/' "$HOME"/.wasmd/config/genesis.json

if ! wasmd keys show validator; then
  (echo "$PASSWORD"; echo "$PASSWORD") | wasmd keys add validator --keyring-backend="test"
fi
# hardcode the validator account for this instance
echo "$PASSWORD" | wasmd add-genesis-account validator "1000000000$STAKE,1000000000$FEE" --keyring-backend="test"

# (optionally) add a few more genesis accounts
for addr in "$@"; do
  echo $addr
  wasmd add-genesis-account "$addr" "1000000000$STAKE,1000000000$FEE" --keyring-backend="test"
done

# submit a genesis validator tx
## Workraround for https://github.com/cosmos/cosmos-sdk/issues/8251
(echo "$PASSWORD"; echo "$PASSWORD"; echo "$PASSWORD") | wasmd gentx validator "250000000$STAKE" --chain-id="$CHAIN_ID" --amount="250000000$STAKE" --keyring-backend="test"
## should be:
# (echo "$PASSWORD"; echo "$PASSWORD"; echo "$PASSWORD") | wasmd gentx validator "250000000$STAKE" --chain-id="$CHAIN_ID"
wasmd collect-gentxs
