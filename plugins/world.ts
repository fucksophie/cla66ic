import { Plugin, World } from "../classes/classes.ts";
import { Server } from "../classes/Server.ts";
import { config } from "../deps.ts";

export default class CommandPlugin extends Plugin {
  commands = [
    "g",
    "worlds",
    "world",
  ];

  constructor(server: Server) {
    super();

    this.server = server;
    this.on("setblock", (player, _mode, _id) => {
      const world = server.worlds.find((e) => e.name == player.world)!;
      if (!world.optionalJson?.builders?.includes("*")) {
        if (!world.optionalJson?.builders?.includes(player.username)) {
          player.message("You are %cnot allowed &fto build in this world!");
          return true;
        }
      }

      return false;
    });
    this.on("command", async (command, player, args) => {
      if (command == "g") {
        const requestedWorld = server.worlds.find((e) =>
          e.name.toLowerCase() == args.join(" ").toLowerCase()
        );
        if (requestedWorld) {
          player.toWorld(requestedWorld);
        } else {
          player.message(`World ${args.join(" ")} does &4not exist!`);
        }
      } else if (command == "worlds") {
        player.message(
          `Available worlds (/g): &a${
            server.worlds.map((e) => e.name).join(", ")
          }`,
        );
      } else if (command == "world") {
        const category = args[0];

        if (category == "create") {
          if (!server.worlds.find((e) => e.name == player.username)) {
            const world = new World(
              { x: 64, y: 64, z: 64 },
              player.username,
            );
            world.optionalJson.builders = [];
            world.optionalJson.builders.push(player.username);
            server.worlds.push(world);

            player.message(`&aWorld created!&f Use /g ${player.username}!`);
          } else {
            player.message(
              `&cYou already own a world!&f Use /g ${player.username}!`,
            );
          }
        } else if (category == "delete") {
          const world = server.worlds.find((e) => e.name == player.username);
          if (world) {
            server.broadcastPacket((e) => e.toWorld(server.worlds[0]), player);

            player.toWorld(server.worlds[0]);

            await world.delete();

            server.worlds = server.worlds.filter((e) =>
              e.name !== player.username
            );

            player.message(`&cWorld deleted.`);
          } else {
            player.message(
              `&cYou don't have a world.`,
            );
          }
        } else if (category == "builders") {
          const subcategory = args[1];
          let world = server.worlds.find((e) => e.name == player.username);

          if (args[3] && config.ops.includes(player.username)) {
            world = server.worlds.find((e) => e.name == args[3]);

            player.message(
              `&aOP Overwrite detected! Operating on world ${args[3]}`,
            );
          }

          if (!world) {
            player.message(`&cWorld does not exist/you do not own a world.`);
            return;
          }

          if (!world.optionalJson?.builders) world.optionalJson.builders = [];

          if (subcategory == "add") {
            const username = args[2];
            world.optionalJson.builders.push(username);
            player.message(
              `&a${username}&f sucesfully added as a builder to world &a${world.name}!`,
            );
            await world.save();
          } else if (subcategory == "remove") {
            const username = args[2];

            const before = world.optionalJson.builders.length;

            world.optionalJson.builders = world.optionalJson.builders.filter((
              e: string,
            ) => e !== username);

            const after = world.optionalJson.builders.length;

            player.message(
              `Removed &a${
                before - after
              }&f builder/s with name &a${username}&f in world &a${world.name}!`,
            );
            await world.save();
          } else if (subcategory == "list") {
            player.message(
              `&a${world.name}&f's builders: &a${
                world.optionalJson.builders.join(", ")
              }`,
            );
          } else {
            player.message(
              `&a/world builders [add/remove/list] USERNAME`,
            );
          }
        } else {
          player.message(
            `&a/world [create/delete/builders]`,
          );
        }
      }
    });
  }
}
