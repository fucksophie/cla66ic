import { PacketWriter, Player, Plugin } from "../classes/classes.ts";
import { Server } from "../classes/Server.ts";
import { config } from "../deps.ts";

export default class CommandPlugin extends Plugin {
  commands = [
    "help",
    "reloadplugins",
    "clients",
    "tp",
    "eval"
  ];

  async tp(from: Player, to: Player) {
    if(to.world != from.world) {
      from.toWorld(this.server.worlds.find((e) =>
        e.name == to.world
      )!);
    }      
    
    await from.writeToSocket(
      new PacketWriter()
        .writeByte(0x08)
        .writeSByte(255)
        .writeShort(to.position.x)
        .writeShort(to.position.y)
        .writeShort(to.position.z)
        .writeByte(to.rotation.yaw)
        .writeByte(to.rotation.pitch)
        .toPacket(),
    );
  }

  constructor(server: Server) {
    super();

    this.server = server;

    this.on("command", async (command, player, args) => {
      if (command == "help") {
        let allComamnds = "";
        for (const [_k, v] of server.plugins) {
          allComamnds += `${v.plugin.commands.join(", ")}, `;
        }
        player.message(allComamnds.slice(0, -2));
      } else if (command == "reloadplugins") {
        if (config.ops.includes(player.username)) {
          server.broadcast(
            "&cRestarting plugins. &fServer will be &4unstable.",
          );
          await this.server.updatePlugins();
          server.broadcast("&eFinished! Server should be now &amostly stable.");
        }
      } else if (command == "clients") {
        this.server.worlds.forEach((e) => {
          const players = this.server.players.filter((b) => e.name == b.world);
          if (players.length != 0) {
            player.message(
              `&a${e.name}&f: &a${players.map((e) => e.username).join(", ")}`,
            );
          }
        });
      } else  if(command == "eval") {
        if(config.ops.includes(player.username)) {

          server.broadcast(eval(args.join(" ")));
        }
      } else if (command == "tp") {
        if(args.length == 1) {
          const teleportTo = this.server.players.find((e) => args[0] === e.username)

          if(teleportTo) {
            await this.tp(player, teleportTo);
          } else {
            player.message("Player is missing")
          }
        } else if(args.length == 3) {
          const x = +args[0]
          const y = +args[1]
          const z = +args[2]
          
          if(isNaN(x) || isNaN(y) || isNaN(z)) {
            player.message("invalid coords")
            return;
          }
          await player.writeToSocket(
            new PacketWriter()
              .writeByte(0x08)
              .writeSByte(255)
              .writeShort(x * 32)
              .writeShort(y * 32)
              .writeShort(z * 32)
              .writeByte(player.rotation.yaw)
              .writeByte(player.rotation.pitch)
              .toPacket(),
          );
        }
    }
  });
  }
}
