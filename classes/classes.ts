import { EventEmitter } from "../deps.ts";
import { Player } from "./Player.ts";
import { Server } from "./Server.ts";

export { Player } from "./Player.ts";
export { World } from "./World.ts";
export { PacketDefinitions, PacketReader, PacketWriter } from "./Packets.ts";

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Rotation {
  yaw: number;
  pitch: number;
}

export abstract class Plugin extends EventEmitter<{
  command(
    command: string,
    player: Player,
    args: string[],
  ): void;

  setblock(
    player: Player,
    mode: number,
    id: number,
    position: Position,
    blockBefore: number,
  ): void;

  stop(): void;
}> {
  commands: string[] = [];

  server!: Server;
}
