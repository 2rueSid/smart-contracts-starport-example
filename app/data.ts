import { SigningCosmWasmClientOptions } from '@cosmjs/cosmwasm-stargate';
import { Bech32, fromBase64 } from '@cosmjs/encoding';
import { ContractUploadInstructions } from './types';
import hackatom from './contract.json';
import { randomBytes } from 'crypto';
import {
  AuthExtension,
  BankExtension,
  QueryClient,
  setupAuthExtension,
  setupBankExtension,
} from '@cosmjs/stargate';
import {
  setupWasmExtension,
  WasmExtension,
} from '@cosmjs/cosmwasm-stargate/build/queries';
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';

export const alice = {
  mnemonic:
    'present damp inmate save east more earn infant pull turkey plate occur device old skirt movie often ensure zoo enforce manual merit shuffle stairs',
  pubkey0: {
    value:
      'wasmpub1addwnpepqtyuccdk8mayau2t3xpvd55nhxkuusdkykm5zr70gu5l2vemxn8dj2nmw47',
  },
  address0: 'wasm13la3jzxy6xlllk4a449erzzed37md6jha7yt7w',
};

export const wasmd = {
  blockTime: 1_000, // ms
  chainId: 'wasmd',
  endpoint: 'http://0.0.0.0:26657',
  prefix: 'wasm',
  validator: {
    address: 'wasm13la3jzxy6xlllk4a449erzzed37md6jha7yt7w',
  },
};

export const defaultSigningClientOptions: SigningCosmWasmClientOptions = {
  broadcastPollIntervalMs: 300,
  broadcastTimeoutMs: 8_000,
};

export function getHackatom(): ContractUploadInstructions {
  return {
    data: fromBase64(hackatom.data),
  };
}

export function makeRandomAddress(): string {
  return Bech32.encode('wasm', randomBytes(20));
}

export async function makeWasmClient(
  endpoint: string
): Promise<QueryClient & AuthExtension & BankExtension & WasmExtension> {
  const tmClient = await Tendermint34Client.connect(endpoint);
  return QueryClient.withExtensions(
    tmClient,
    setupAuthExtension,
    setupBankExtension,
    setupWasmExtension
  );
}
