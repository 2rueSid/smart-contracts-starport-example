import { toAscii } from '@cosmjs/encoding';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';

import { alice, getHackatom, makeRandomAddress, wasmd } from './data';
import { broadcastTx, getAllContractState, getCode, getContractCodeHistory, getContractInfo, instantiateContract, listCodeInfo, queryContractRaw, queryContractSmart, uploadContract } from './handlers';

const run = async () => {
  const hackatom = getHackatom();
  const hackatomConfigKey = toAscii('config');
  let hackatomCodeId: number | undefined;
  let hackatomContractAddress: string | undefined;

  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(alice.mnemonic, {
    prefix: wasmd.prefix,
  });

  const result = await uploadContract(wallet, hackatom);

  hackatomCodeId = Number.parseInt(
    JSON.parse(result.rawLog!)[0]
      .events.find((event: any) => event.type === 'store_code')
      .attributes.find((attribute: any) => attribute.key === 'code_id').value,
    10
  );

  const instantiateResult = await instantiateContract(
    wallet,
    hackatomCodeId,
    makeRandomAddress()
  );

  hackatomContractAddress = JSON.parse(instantiateResult.rawLog!)[0]
    .events.find((event: any) => event.type === 'instantiate')
    .attributes.find(
      (attribute: any) => attribute.key === '_contract_address'
    ).value;

  console.log('listCodeInfo');
  console.log(await listCodeInfo());

  console.log('getCode');
  console.log(await getCode(hackatomCodeId));

  console.log('get contract info');
  console.log(await getContractInfo(hackatomCodeId));

  console.log('getContractCodeHistory');
  console.log(await getContractCodeHistory(hackatomCodeId));

  console.log('getAllContractState');
  console.log(await getAllContractState(hackatomContractAddress));

  console.log('queryContractRaw');
  console.log(
    await queryContractRaw(hackatomContractAddress, hackatomConfigKey)
  );

  console.log('queryContractSmart');
  console.log(await queryContractSmart(hackatomContractAddress));

  console.log('broadcastTx');
  console.log(await broadcastTx());
};

run();
