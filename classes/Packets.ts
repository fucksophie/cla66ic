export class PacketReader {
  buffer: Uint8Array;
  private view: DataView;
  pos: number;
  totalPacketSize = 0;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.view = new DataView(buffer.buffer);
    this.pos = 0;
  }

  readByte(): number {
    const x = this.buffer[this.pos];
    this.pos += 1;
    this.totalPacketSize += 1;

    return x;
  }

  readShort(): number {
    const x = this.view.getInt16(this.pos);
    this.pos += 2;
    this.totalPacketSize += 2;
    return x;
  }

  readSByte(): number {
    const x = this.view.getInt8(this.pos);
    this.pos += 1;
    this.totalPacketSize += 1;
    return x;
  }
  readInt() {
    const x = this.view.getInt32(this.pos);
    this.pos += 4;
    this.totalPacketSize += 4;
    return x;
  }
  readString(): string {
    const x = this.buffer.subarray(this.pos, this.pos + 64);
    this.pos += 64;
    this.totalPacketSize += 64;
    return new TextDecoder().decode(x).trimEnd();
  }

  readByteArray(): Uint8Array {
    const x = this.buffer.subarray(this.pos, this.pos + 1024);
    this.pos += 1024;
    this.totalPacketSize += 1024;
    return x;
  }
}

export class PacketWriter {
  private buffer: Uint8Array;
  private view: DataView;
  private pos: number;

  constructor(lenght: number = 4096) {
    this.buffer = new Uint8Array(lenght);
    this.view = new DataView(this.buffer.buffer);
    this.pos = 0;
  }

  writeByte(n: number) {
    this.buffer[this.pos] = n;
    this.pos += 1;
    return this;
  }

  writeShort(n: number) {
    this.view.setInt16(this.pos, n);
    this.pos += 2;
    return this;
  }

  writeSByte(n: number) {
    this.view.setInt8(this.pos, n);
    this.pos += 1;
    return this;
  }
  writeInt(n: number) {
    this.view.setInt32(this.pos, n);
    this.pos += 4;
    return this;
  }
  writeString(n: string) {
    const b = new TextEncoder().encode(n);

    for (let x = 0; x < 64; x++) {
      this.buffer[this.pos + x] = b[x] ?? 0x20;
    }
    this.pos += 64;
    return this;
  }

  writeByteArray(n: Uint8Array) {
    for (let x = 0; x < 1024; x++) {
      this.buffer[this.pos + x] = n[x] || 0;
    }
    this.pos += 1024;
    return this;
  }

  toPacket() {
    return this.buffer.subarray(0, this.pos);
  }
}

import { gzip } from "https://cdn.skypack.dev/pako";
import { Position, World } from "./classes.ts";
import { Player } from "./Player.ts";

export class PacketDefinitions {
  static async levelInit(player: Player) {
    await player.writeToSocket(new Uint8Array([0x02]));
  }
  static async levelProgress(
    length: number,
    chunk: Uint8Array,
    progress: number,
    player: Player,
  ) {
    await player.writeToSocket(
      new PacketWriter()
        .writeByte(0x03)
        .writeShort(length)
        .writeByteArray(chunk)
        .writeByte(progress)
        .toPacket(),
    );
  }

  static async sendPackets(player: Player, world: World) {
    await PacketDefinitions.levelInit(player);

    player.position = world.getSpawn();

    const compressedMap = gzip(world.data)!;

    for (let i = 0; i < compressedMap.length; i += 1024) {
      const chunk = compressedMap.slice(
        i,
        Math.min(i + 1024, compressedMap.length),
      );
      await PacketDefinitions.levelProgress(chunk.length, chunk, 1, player);
    }

    await PacketDefinitions.levelFinish(world.size, player);

    await PacketDefinitions.spawn(player, -1, player);

  }
  static async levelFinish(size: Position, player: Player) {
    await player.writeToSocket(
      new PacketWriter()
        .writeByte(0x04)
        .writeShort(size.x)
        .writeShort(size.y)
        .writeShort(size.z)
        .toPacket(),
    );
  }
  static async defineBlock(block: {
    blockID: number;
    name: string;
    solidity?: number;
    movementSpeed?: number;
    toptextureID: number;
    sidetextureID: number;
    bottomtextureID: number;
    transmitsLight?: number;
    walkSound: number;
    shape?: number;
    fullBright?: number;
    blockDraw?: number;
    fogDensity?: number;
    fogR?: number;
    fogG?: number;
    fogB?: number;
  }, player: Player) {
    if (!block.solidity) block.solidity = 2;
    if (!block.movementSpeed) block.movementSpeed = 128;
    if (!block.transmitsLight) block.transmitsLight = 0;
    if (!block.fullBright) block.fullBright = 0;
    if (!block.shape) block.shape = 16;
    if (!block.blockDraw) block.blockDraw = 0;
    if (!block.fogDensity) block.fogDensity = 0;
    if (!block.fogR) block.fogR = 0;
    if (!block.fogG) block.fogG = 0;
    if (!block.fogB) block.fogB = 0;

    await player.writeToSocket(
      new PacketWriter()
        .writeByte(0x23)
        .writeByte(block.blockID)
        .writeString(block.name)
        .writeByte(block.solidity)
        .writeByte(block.movementSpeed)
        .writeByte(block.toptextureID)
        .writeByte(block.sidetextureID)
        .writeByte(block.bottomtextureID)
        .writeByte(block.transmitsLight)
        .writeByte(block.walkSound)
        .writeByte(block.fullBright)
        .writeByte(block.shape)
        .writeByte(block.blockDraw)
        .writeByte(block.fogDensity)
        .writeByte(block.fogR)
        .writeByte(block.fogG)
        .writeByte(block.fogB)
        .toPacket(),
    );
  }
  static async disconnect(reason: string, player: Player) {
    await player.writeToSocket(
      new PacketWriter()
        .writeByte(0x0e)
        .writeString(reason)
        .toPacket(),
    );
  }

  static async spawn(player: Player, id: number, toplayer: Player) {
    await toplayer.writeToSocket(
      new PacketWriter()
        .writeByte(0x07)
        .writeSByte(id)
        .writeString(player.username)
        .writeShort(player.position.x)
        .writeShort(player.position.y)
        .writeShort(player.position.z)
        .writeByte(0)
        .writeByte(0).toPacket(),
    );
  }

  static async movement(player: Player, id: number, toplayer: Player) {
    await toplayer.writeToSocket(
      new PacketWriter()
        .writeByte(0x08)
        .writeSByte(id)
        .writeShort(player.position.x)
        .writeShort(player.position.y)
        .writeShort(player.position.z)
        .writeByte(player.rotation.yaw)
        .writeByte(player.rotation.pitch)
        .toPacket(),
    );
  }

  static async setBlock(position: Position, block: number, player: Player) {
    await player.writeToSocket(
      new PacketWriter()
        .writeByte(0x06)
        .writeShort(position.x)
        .writeShort(position.y)
        .writeShort(position.z)
        .writeByte(block)
        .toPacket(),
    );
  }
  static async despawn(index: number, player: Player) {
    await player.writeToSocket(
      new PacketWriter()
        .writeByte(0x0c)
        .writeSByte(index)
        .toPacket(),
    );
  }

  static async customblock(player: Player) {
    await player.writeToSocket(
      new PacketWriter()
        .writeByte(0x013)
        .writeByte(1)
        .toPacket(),
    );
  }
  static async changeModel(id: number, modelName: string, player: Player) {
    await player.writeToSocket(
      new PacketWriter()
        .writeByte(0x1D)
        .writeByte(id)
        .writeString(modelName)
        .toPacket(),
    );
  }
  static async sendTexturePack(tx: string, player: Player) {
    await player.writeToSocket(
      new PacketWriter()
        .writeByte(0x28)
        .writeString(tx)
        .toPacket(),
    );
  }
  static async ident(name: string, motd: string, player: Player) {
    await player.writeToSocket(
      new PacketWriter()
        .writeByte(0x00)
        .writeByte(0x07)
        .writeString(name)
        .writeString(motd)
        .writeByte(0x00)
        .toPacket(),
    );
  }
}
