import { Position, Rotation, World } from "./classes.ts";
import { PacketDefinitions, PacketWriter } from "./Packets.ts";
import { log } from "../deps.ts";
import { Server } from "./Server.ts";

export class Player {
  socket: Deno.Conn;
  private server: Server;

  username: string;
  id: number;
  world = "main";
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

    let id = Math.floor(Math.random() * 255);

    // reassigns ID until finds available one
    // if we reach 255 players this will loop forever
    while(server.players.find(e => e.id == id)) id = Math.floor(Math.random() * 255);

    this.id = id;
  }

  async writeToSocket(ar: Uint8Array) {
    await this.socket.write(ar).catch((e) => {
      log.critical(e);
      this.server.removeUser(this.socket);
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

  async toWorld(world: World) {
    this.server.broadcastPacket(
      (e) => PacketDefinitions.despawn(this.id, e),
      this,
    );

    this.world = world.name;

    PacketDefinitions.sendPackets(this, world);

    this.server.broadcastPacket(
      (e) =>
        PacketDefinitions.spawn(this, this.id, e),
      this,
    );
    this.server.broadcastPacket(
      (e) => PacketDefinitions.spawn(e, e.id, this),
      this,
    );

    this.message("You have been moved.");

    await world.save();
  }
}
