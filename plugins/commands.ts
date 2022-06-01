import { Plugin } from "../classes/classes.ts";
import { Server } from "../classes/Server.ts";
import { config } from "../deps.ts";

export default class CommandPlugin extends Plugin {
  commands = [
    "help",
    "reloadplugins",
    "clients",
  ];

  constructor(server: Server) {
    super();

    this.server = server;
    
    this.on("command", async (command, player) => {
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
      }
    });
  }
}
