import { Position, Rotation, World } from "./classes.ts";
import { PacketDefinitions, PacketWriter } from "./Packets.ts";
import { config, log } from "../deps.ts";
import { Server } from "./Server.ts";

export class Player {
  socket: Deno.Conn;
  private server: Server;

  username: string;
  ip: string;
  id: number;
  world = config.main;
  position: Position;
  rotation: Rotation = { yaw: 0, pitch: 0 };

  constructor(
    socket: Deno.Conn,
    username: string,
    position: Position,
    server: Server,
  ) {
    this.socket = socket;
    this.username = username;
    this.position = position;
    this.server = server;
    this.ip = (this.socket.remoteAddr as Deno.NetAddr).hostname;

    let id = Math.floor(Math.random() * server.maxUsers);

    // reassigns ID until finds available one

    while (server.players.find((e) => e.id == id)) {
      id = Math.floor(Math.random() * server.maxUsers);
    }
    this.id = id;
  }

  async writeToSocket(ar: Uint8Array) {
    await this.socket.write(ar).catch(async (e) => {
      log.critical(e);
      await this.server.removeUser(
        this.socket,
        "Write failed" + e.message.split("\n")[0],
      );
    });
  }

  message(text: string, id = 0) {
    text.replaceAll("%", "&").match(/.{1,64}/g)?.forEach(async (pic) => {
      await this.writeToSocket(
        new PacketWriter()
          .writeByte(0x0d)
          .writeSByte(id)
          .writeString(pic)
          .toPacket(),
      );
    });
  }

  toWorld(world: World) {
    this.server.broadcastPacket(
      (e) => PacketDefinitions.despawn(this.id, e),
      this,
    );

    this.world = world.name;

    PacketDefinitions.sendPackets(this, world);

    this.server.broadcastPacket(
      (e) => PacketDefinitions.spawn(this, this.id, e),
      this,
    );
    this.server.broadcastPacket(
      (e) => PacketDefinitions.spawn(e, e.id, this),
      this,
    );

    this.message("You have been moved.");
  }
}
