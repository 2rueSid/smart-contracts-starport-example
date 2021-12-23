import {
  MsgExecuteContractEncodeObject,
  MsgInstantiateContractEncodeObject,
  MsgStoreCodeEncodeObject,
  SigningCosmWasmClient,
} from '@cosmjs/cosmwasm-stargate';
import { fromAscii, toAscii } from '@cosmjs/encoding';
import {
  coin,
  Coin,
  coins,
  DirectSecp256k1HdWallet,
  OfflineDirectSigner,
  Registry,
} from '@cosmjs/proto-signing';
import { logs, SigningStargateClient, StdFee } from '@cosmjs/stargate';
import {
  MsgExecuteContract,
  MsgInstantiateContract,
  MsgStoreCode,
} from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import Long = require('long');
import {
  alice,
  defaultSigningClientOptions,
  getHackatom,
  makeRandomAddress,
  makeWasmClient,
  wasmd,
} from './data';

import { ContractUploadInstructions } from './types';

const registry = new Registry([
  ['/cosmwasm.wasm.v1.MsgExecuteContract', MsgExecuteContract],
  ['/cosmwasm.wasm.v1.MsgStoreCode', MsgStoreCode],
  ['/cosmwasm.wasm.v1.MsgInstantiateContract', MsgInstantiateContract],
]);

export async function broadcastTx() {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(alice.mnemonic, {
    prefix: wasmd.prefix,
  });
  const client = await makeWasmClient(wasmd.endpoint);

  const funds = [coin(1234, 'ucosm'), coin(321, 'ustake')];
  const beneficiaryAddress = makeRandomAddress();

  let codeId: number;

  let uploadRes;
  let initiateRes;
  let executeRes;
  let beneficiaryBalanceUcosm;
  let beneficiaryBalanceUstake;

  // upload
  {
    const result = await uploadContract(wallet, getHackatom());
    const parsedLogs = logs.parseLogs(logs.parseRawLog(result.rawLog));
    const codeIdAttr = logs.findAttribute(parsedLogs, 'store_code', 'code_id');
    codeId = Number.parseInt(codeIdAttr.value, 10);

    uploadRes = result;
  }

  // instantiate
  let contractAddress: string;
  {
    const result = await instantiateContract(
      wallet,
      codeId,
      beneficiaryAddress,
      funds
    );

    const parsedLogs = logs.parseLogs(logs.parseRawLog(result.rawLog));
    const contractAddressAttr = logs.findAttribute(
      parsedLogs,
      'instantiate',
      '_contract_address'
    );
    contractAddress = contractAddressAttr.value;
    initiateRes = result;
  }
  // execute
  {
    const result = await executeContract(wallet, contractAddress, {
      release: {},
    });
    const parsedLogs = logs.parseLogs(logs.parseRawLog(result.rawLog));
    const wasmEvent = parsedLogs
      .find(() => true)
      ?.events.find((e) => e.type === 'wasm');
    // Verify token transfer from contract to beneficiary
    beneficiaryBalanceUcosm = await client.bank.balance(
      beneficiaryAddress,
      'ucosm'
    );
    beneficiaryBalanceUstake = await client.bank.balance(
      beneficiaryAddress,
      'ustake'
    );
    executeRes = result;
  }

  return {
    uploadRes,
    initiateRes,
    executeRes,
    beneficiaryBalanceUcosm,
    beneficiaryBalanceUstake,
  };
}

export async function queryContractSmart(hackatomContractAddress) {
  const client = await makeWasmClient(wasmd.endpoint);
  const request = { verifier: {} };
  const result = await client.wasm.queryContractSmart(
    hackatomContractAddress,
    request
  );

  return { result };
}

export async function queryContractRaw(
  hackatomContractAddress,
  hackatomConfigKey
) {
  const client = await makeWasmClient(wasmd.endpoint);
  const raw = await client.wasm.queryContractRaw(
    hackatomContractAddress,
    hackatomConfigKey
  );
  const model = JSON.parse(fromAscii(raw.data));

  return { model };
}

export async function getAllContractState(hackatomContractAddress) {
  const client = await makeWasmClient(wasmd.endpoint);
  const { models } = await client.wasm.getAllContractState(
    hackatomContractAddress
  );
  const data = models[0];

  const value = JSON.parse(fromAscii(data.value));

  return { models, value };
}

export async function getContractCodeHistory(hackatomCodeId) {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(alice.mnemonic, {
    prefix: wasmd.prefix,
  });
  const client = await makeWasmClient(wasmd.endpoint);

  // create new instance and compare before and after
  const funds = coins(707707, 'ucosm');
  const beneficiaryAddress = makeRandomAddress();

  const result = await instantiateContract(
    wallet,
    hackatomCodeId,
    beneficiaryAddress,
    funds
  );

  const myAddress = JSON.parse(result.rawLog!)[0]
    .events.find((event: any) => event.type === 'instantiate')
    .attributes!.find(
      (attribute: any) => attribute.key === '_contract_address'
    ).value;

  const history = await client.wasm.getContractCodeHistory(myAddress);

  return { history };
}

export async function getContractInfo(hackatomCodeId) {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(alice.mnemonic, {
    prefix: wasmd.prefix,
  });
  const client = await makeWasmClient(wasmd.endpoint);

  // create new instance and compare before and after
  const { contracts: existingContracts } =
    await client.wasm.listContractsByCodeId(hackatomCodeId);

  const beneficiaryAddress = makeRandomAddress();
  const funds = coins(707707, 'ucosm');
  const result = await instantiateContract(
    wallet,
    hackatomCodeId,
    beneficiaryAddress,
    funds
  );

  const myAddress = JSON.parse(result.rawLog!)[0]
    .events.find((event: any) => event.type === 'instantiate')
    .attributes!.find(
      (attribute: any) => attribute.key === '_contract_address'
    ).value;

  const { contracts: newContracts } = await client.wasm.listContractsByCodeId(
    hackatomCodeId
  );

  const newContract = newContracts[newContracts.length - 1];

  const { contractInfo } = await client.wasm.getContractInfo(myAddress);

  return { contractInfo, existingContracts, newContract };
}

export async function getCode(hackatomCodeId) {
  const client = await makeWasmClient(wasmd.endpoint);
  const { codeInfo, data } = await client.wasm.getCode(hackatomCodeId);

  return { codeInfo, data };
}

export async function listCodeInfo() {
  const client = await makeWasmClient(wasmd.endpoint);
  const { codeInfos } = await client.wasm.listCodeInfo();
  const lastCode = codeInfos[codeInfos.length - 1];

  return { codeInfos, lastCode };
}

export async function uploadContract(
  signer: OfflineDirectSigner,
  contract: ContractUploadInstructions
) {
  const memo = 'My first contract on chain';
  const theMsg: MsgStoreCodeEncodeObject = {
    typeUrl: '/cosmwasm.wasm.v1.MsgStoreCode',
    value: MsgStoreCode.fromPartial({
      sender: alice.address0,
      wasmByteCode: contract.data,
    }),
  };

  const fee: StdFee = {
    amount: coins(2000000, 'ucosm'),
    gas: '89000000',
  };

  const firstAddress = (await signer.getAccounts())[0].address;

  const client = await SigningStargateClient.connectWithSigner(
    wasmd.endpoint,
    signer,
    {
      ...defaultSigningClientOptions,
      registry,
    }
  );

  return client.signAndBroadcast(firstAddress, [theMsg], fee, memo);
}

export async function instantiateContract(
  signer: OfflineDirectSigner,
  codeId: number,
  beneficiaryAddress: string,
  funds?: readonly Coin[]
) {
  const memo = 'Create an escrow instance';
  const theMsg: MsgInstantiateContractEncodeObject = {
    typeUrl: '/cosmwasm.wasm.v1.MsgInstantiateContract',
    value: MsgInstantiateContract.fromPartial({
      sender: alice.address0,
      codeId: Long.fromNumber(codeId),
      label: 'my escrow',
      msg: toAscii(
        JSON.stringify({
          verifier: alice.address0,
          beneficiary: beneficiaryAddress,
        })
      ),
      funds: funds ? [...funds] : [],
    }),
  };
  const fee: StdFee = {
    amount: coins(5000000, 'ucosm'),
    gas: '89000000',
  };

  const firstAddress = (await signer.getAccounts())[0].address;
  const client = await SigningStargateClient.connectWithSigner(
    wasmd.endpoint,
    signer,
    {
      ...defaultSigningClientOptions,
      registry,
    }
  );
  return client.signAndBroadcast(firstAddress, [theMsg], fee, memo);
}

export async function executeContract(
  signer: OfflineDirectSigner,
  contractAddress: string,
  msg: Record<string, unknown>
) {
  const memo = 'Time for action';
  const theMsg: MsgExecuteContractEncodeObject = {
    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
    value: MsgExecuteContract.fromPartial({
      sender: alice.address0,
      contract: contractAddress,
      msg: toAscii(JSON.stringify(msg)),
      funds: [],
    }),
  };
  const fee: StdFee = {
    amount: coins(5000000, 'ucosm'),
    gas: '89000000',
  };

  const firstAddress = (await signer.getAccounts())[0].address;
  const client = await SigningCosmWasmClient.connectWithSigner(
    wasmd.endpoint,
    signer,
    {
      ...defaultSigningClientOptions,
      registry,
    }
  );
  return client.signAndBroadcast(firstAddress, [theMsg], fee, memo);
}
