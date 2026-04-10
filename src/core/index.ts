/**
 * FairCoin core protocol layer.
 * Re-exports all cryptographic primitives and protocol utilities.
 */

export {
  type NetworkType,
  type NetworkConfig,
  MAINNET,
  TESTNET,
  getNetwork,
} from "./network";

export {
  hexToBytes,
  bytesToHex,
  base58CheckEncode,
  base58CheckDecode,
  encodeAddress,
  decodeAddress,
  type DecodedAddress,
  encodeWIF,
  decodeWIF,
  type DecodedWIF,
  writeVarInt,
  readVarInt,
  type VarIntResult,
  writeUInt32LE,
  readUInt32LE,
  writeUInt64LE,
  readUInt64LE,
  writeInt32LE,
  readInt32LE,
  BufferWriter,
  BufferReader,
} from "./encoding";

export {
  hash160,
  publicKeyToAddress,
  addressToScriptHash,
  validateAddress,
  isP2PKH,
  isP2SH,
  reverseHex,
} from "./address";

export {
  Opcodes,
  pushData,
  createP2PKHScript,
  createP2SHScript,
  createP2PKHScriptSig,
  isP2PKHScript,
  isP2SHScript,
  extractAddressFromScript,
} from "./script";

export {
  type HDNode,
  type DerivedAddress,
  generateMnemonic,
  validateMnemonic,
  mnemonicToSeed,
  deriveKeyFromSeed,
  getDerivationPath,
  deriveAddress,
} from "./hd-wallet";

export {
  SIGHASH_ALL,
  type TxInput,
  type TxOutput,
  type Transaction,
  type UTXO,
  type BuildTransactionParams,
  serializeTransaction,
  deserializeTransaction,
  hashTransaction,
  signInput,
  estimateTxSize,
  buildTransaction,
} from "./transaction";

export {
  type BlockHeader,
  serializeBlockHeader,
  quarkHash,
  hashBlockHeader,
  doubleSha256,
} from "./quark-hash";

export {
  type BIP38DecryptResult,
  encryptBIP38,
  decryptBIP38,
} from "./bip38";

export {
  type Checkpoint,
  MAINNET_CHECKPOINTS,
  TESTNET_CHECKPOINTS,
  getCheckpoints,
  getLatestCheckpoint,
  isCheckpointHeight,
  getCheckpointHash,
} from "./checkpoints";

export {
  type FairCoinURI,
  parseFairCoinURI,
  buildFairCoinURI,
} from "./uri";
