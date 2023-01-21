/*
 * UF2 (USB Flashing Format) JavaScript Library
 *
 * UF2 Format specification: https://github.com/microsoft/uf2
 *
 * Copyright (C) 2021, Uri Shaked.
 * Released under the terms of the MIT License.
 */

import { uf2Families } from './uf2families';
export { uf2Families };

export const magicValues = [
  { offset: 0, value: 0x0a324655 },
  { offset: 4, value: 0x9e5d5157 },
  { offset: 508, value: 0x0ab16f30 },
];

export const maxPayloadSize = 476;

export const UF2Flags = {
  notMainFlash: 0x00000001,
  fileContainer: 0x00001000,
  familyIDPresent: 0x00002000,
  md5ChecksumPresent: 0x00004000,
  extensionTagsPresent: 0x00008000,
};

export const familyMap = new Map<number, string>(uf2Families.map((f) => [f.id, f.description]));

export function familyID(familyName: string) {
  for (const [id, name] of familyMap.entries()) {
    if (name === familyName) {
      return id;
    }
  }
  return null;
}

export interface UF2BlockData {
  /** See UF2Flags for possible flag values. */
  flags: number;

  /** Address in flash where the data should be written */
  flashAddress: number;

  /** The payload usually contains 256 bytes, but can be up to 476 bytes */
  payload: Uint8Array;

  /** Sequential block number; starts at 0 */
  blockNumber: number;

  /** Total number of blocks in file */
  totalBlocks: number;

  /**
   * Board family ID, file size, or zero (depending on Flags)
   */
  boardFamily: number;
}

export class UF2DecodeError extends Error {}
export class UF2EncodeError extends Error {}

export function isUF2Block(data: Uint8Array) {
  const dataView = new DataView(data.buffer);
  if (data.length !== 512) {
    return false;
  }
  for (let { offset, value } of magicValues) {
    if (dataView.getUint32(offset, true) !== value) {
      return false;
    }
  }
  return true;
}

export function decodeBlock(data: Uint8Array): UF2BlockData {
  if (data.length !== 512) {
    throw new UF2DecodeError('Invalid UF2 block size. Block size must be exactly 512 bytes.');
  }
  const dataView = new DataView(data.buffer);
  for (let { offset, value } of magicValues) {
    const actual = dataView.getUint32(offset, true);
    if (actual !== value) {
      throw new UF2DecodeError(
        `Invalid magic value at offset ${offset}: expected 0x${value.toString(16)}, ` +
          `but found 0x${actual.toString(16)}.`
      );
    }
  }
  const flags = dataView.getUint32(8, true);
  const flashAddress = dataView.getUint32(12, true);
  const payloadSize = dataView.getUint32(16, true);
  const blockNumber = dataView.getUint32(20, true);
  const totalBlocks = dataView.getUint32(24, true);
  const boardFamily = dataView.getUint32(28, true);
  if (payloadSize > maxPayloadSize) {
    throw new UF2DecodeError(
      `Invalid payload size ${payloadSize}. Should be ${maxPayloadSize} bytes or less.`
    );
  }

  return {
    flags,
    flashAddress,
    payload: data.slice(32, 32 + payloadSize),
    blockNumber,
    totalBlocks,
    boardFamily,
  };
}

export function encodeBlock(
  blockData: UF2BlockData,
  target = new Uint8Array(512),
  targetOffset = 0
) {
  if (target.length < targetOffset + 512) {
    throw new UF2EncodeError(`Can't encode block: target array is too small`);
  }
  if (blockData.payload.length > maxPayloadSize) {
    throw new UF2EncodeError(`Block payload too big; must be ${maxPayloadSize} bytes or less.`);
  }

  target.fill(0, targetOffset, targetOffset + 512);
  const dataView = new DataView(target.buffer, targetOffset);
  for (let { offset, value } of magicValues) {
    dataView.setUint32(offset, value, true);
  }
  dataView.setUint32(8, blockData.flags, true);
  dataView.setUint32(12, blockData.flashAddress, true);
  dataView.setUint32(16, blockData.payload.length, true);
  dataView.setUint32(20, blockData.blockNumber, true);
  dataView.setUint32(24, blockData.totalBlocks, true);
  dataView.setUint32(28, blockData.boardFamily, true);
  target.set(blockData.payload, targetOffset + 32);
  return target;
}
