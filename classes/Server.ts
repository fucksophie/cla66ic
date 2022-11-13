import {
  PacketDefinitions,
  PacketReader,
  Player,
  Plugin,
  World,
} from "./classes.ts";

import { config, crypto, log, s3, toHexString } from "../deps.ts";

type PlayerFunction = (a: Player) => void;

interface PluginUpdateTime {
  plugin: Plugin;
  lastUpdated: Date;
}

export class Server {
  server!: Deno.Listener;

  players: Player[] = [];
  plugins: Map<string, PluginUpdateTime> = new Map();

  lengthMap: Map<number, number> = new Map([
    [0, 130],
    [5, 8],
    [8, 9],
    [13, 65],
  ]);

  maxUsers = config.maxUsers;

  worlds: World[] = [new World({ x: 64, y: 64, z: 64 }, config.main)];

  async start(port: number) {
    this.server = Deno.listen({ port: port });

    try {
      await s3.headBucket({
        Bucket: "cla66ic",
      });

      log.info("s3 bucket exists!");
    } catch {
      log.warning("s3 bucket does not exist.. Creating!");

      await s3.createBucket({
        Bucket: "cla66ic",
      });
    }

    (await s3.listObjects({
      Bucket: "cla66ic",
    })).Contents.forEach((e) => {
      if (e.Key !== config.main + ".buf") {
        log.info(`Autoloaded a world from s3! ${e.Key}`);

        const world = new World({ x: 0, y: 0, z: 0 }, e.Key!.split(".buf")[0]);

        this.worlds.push(world);
      }
    });

    if (config.onlineMode) {
      setInterval(async () => {
        await fetch(
          "https://www.classicube.net/heartbeat.jsp" +
            `?port=${config.port}` +
            `&max=${this.maxUsers}` +
            `&name=${config.name}` +
            "&public=True" +
            `&software=${config.software}` +
            `&version=7&salt=${config.hash}` +
            `&users=${[...new Set(this.players.map((obj) => obj.ip))].length}`,
        );
      }, 10000);
    }

    await this.updatePlugins();

    log.info(`Listening on port ${config.port}!`);

    for await (const socket of this.server) {
      this.startSocket(socket);
    }
  }

  broadcast(text: string) {
    log.info(text.replace(/&./gm, ""));

    text.match(/.{1,64}/g)?.forEach((pic) => {
      this.players.forEach((e) => {
        e.message(pic.trim());
      });
    });
  }

  broadcastPacket(func: PlayerFunction, player: Player) {
    this.players.forEach((e) => {
      if (e.world == player.world && e !== player) {
        func(e);
      }
    });
  }

  async updatePlugins() {
    for await (const file of Deno.readDir("./plugins")) {
      if (file.isFile) {
        const name = file.name.split(".ts")[0];

        if (!this.plugins.has(name)) {
          this.plugins.set(name, {
            lastUpdated: Deno.statSync(`./plugins/${file.name}`).mtime!,
            plugin: new ((await import(`../plugins/${file.name}`)).default)(
              this,
            ),
          });
        } else {
          const plugin = this.plugins.get(name);

          if (
            Deno.statSync(`./plugins/${file.name}`).mtime!.getTime() !==
              plugin?.lastUpdated.getTime()
          ) {
            plugin?.plugin.emit("stop");
            this.plugins.set(name, {
              lastUpdated: Deno.statSync(`./plugins/${file.name}`).mtime!,
              plugin:
                new ((await import(`../plugins/${file.name}#` + Math.random()))
                  .default)(
                  this,
                ),
            });
          }
        }
      }
    }
  }
  async removeUser(conn: Deno.Conn, text: string) {
    const player = this.players.find((e) => e.socket == conn);

    if (!player) return;

    this.players = this.players.filter((e) => e != player);

    try {
      conn.close();
    } catch {
      // whatever
    }

    this.broadcast(`${player.username} has &cleft&f, "${text}"`);

    await this.worlds.find((e) => e.name == player.world)!.save();

    this.broadcastPacket(
      (e) => PacketDefinitions.despawn(player.id, e),
      player,
    );
  }

  async handlePacket(
    buffer: Uint8Array,
    packetType: number,
    connection: Deno.Conn,
  ) {
    const packet = new PacketReader(buffer);
    if (packetType == 0x00) {
      if (this.players.find((e) => e.socket == connection)) return;
      packet.readByte();
      const username = packet.readString();

      const verification = packet.readString();

      if (this.players.length >= this.maxUsers) {
        connection.close();

        return;
      }
      const player = new Player(
        connection,
        username,
        this.worlds[0].getSpawn(),
        this,
      );

      if (!verification) {
        player.socket.close();
        return true;
      }

      const str = toHexString(
        new Uint8Array(
          await crypto.subtle.digest(
            "MD5",
            new TextEncoder().encode(config.hash + player.username),
          ),
        ),
      );
      if (
        config.onlineMode && verification != config.hash &&
        !this.players.find((e) => e.socket == connection)
      ) {
        if (
          str !== verification
        ) {
          await PacketDefinitions.disconnect(
            "Refresh your playerlist! Incorrect hash!",
            player,
          );

          player.socket.close();

          return true;
        }
      }

      if (this.players.find((e) => e.username == player.username)) {
        await PacketDefinitions.disconnect(
          "Your name is already being used!",
          player,
        );
        player.socket.close();
        return true;
      }

      this.players.push(player);
      await PacketDefinitions.ident("cla66ic", "welcome 2 hell", player);

      player.toWorld(this.worlds.find((e) => e.name == player.world)!);
      this.broadcast(`${player.username} has &ajoined`);
    } else if (packetType == 0x08) {
      const player = this.players.find((e) => e.socket == connection);
      if (!player) return;

      packet.readByte();
      player.position.x = packet.readShort();
      player.position.y = packet.readShort();
      player.position.z = packet.readShort();
      player.rotation.yaw = packet.readByte();
      player.rotation.pitch = packet.readByte();
      this.broadcastPacket((e) =>
        PacketDefinitions.movement(
          player,
          player.id,
          e,
        ), player);
    } else if (packetType == 0x0d) {
      packet.readByte();

      const player = this.players.find((e) => e.socket == connection);
      if (!player) return;
      const message = packet.readString();
      let playerColor = "[member] &b";

      if (config.ops.includes(player.username)) {
        playerColor = "[operator] &c";
      }
      if (message.startsWith("/")) {
        const commandMessage = message.substring(1);
        const args = commandMessage.split(" ");
        const command = args.shift()!;

        log.warning(`Command execution "${message}" by ${player.username}.`);

        this.plugins.forEach((value) => {
          if (value.plugin.commands.includes(command)) {
            value.plugin.emit("command", command, player, args);
          }
        });

        return;
      }
      this.broadcast(`${playerColor}${player.username}&f: ${message}`);
    } else if (packetType == 0x05) {
      const player = this.players.find((e) => e.socket == connection);
      if (!player) return;

      const position = {
        x: packet.readShort(),
        y: packet.readShort(),
        z: packet.readShort(),
      };
      const mode = packet.readByte();
      const block = packet.readByte();

      const id = mode ? block : 0;

      const world = this.worlds.find((e) => e.name == player.world);
      if (!world) return;

      let pluginAnswer: boolean[] = [];

      for await (const [_k, v] of this.plugins) {
        pluginAnswer = pluginAnswer.concat(
          await v.plugin.emit("setblock", player, mode, id, position),
        );
      }

      if (pluginAnswer.some((e) => e == true)) {
        PacketDefinitions.setBlock(position, world.getBlock(position), player);
        return;
      }

      world.setBlock(position, id);

      this.broadcastPacket(
        (e) => PacketDefinitions.setBlock(position, id, e),
        player,
      );
    }
  }

  async startSocket(connection: Deno.Conn) {
    while (true) {
      const packetID = new Uint8Array(1);
      let packetIDReadAttempt;

      try {
        packetIDReadAttempt = await connection.read(packetID);
      } catch {
        await this.removeUser(connection, "Packet ID read failed");
        break;
      }

      if (packetIDReadAttempt) {
        const packetLength = this.lengthMap.get(packetID[0]);

        if (!packetLength) {
          log.critical("Unknown Packet: " + packetID[0]);
          await this.removeUser(connection, "Unknown packet ID " + packetID[0]); // TODO: add a reason to this
          break;
        }

        let rawPacket = new Uint8Array(packetLength);
        let packetReadAttempt;

        try {
          packetReadAttempt = await connection.read(rawPacket);
        } catch {
          await this.removeUser(connection, "Packet read attempt failed."); // TODO: add a reason to this
          break;
        }

        let fullRead = packetReadAttempt!;

        while (fullRead < packetLength) {
          const halfPacket = new Uint8Array(packetLength - fullRead);
          rawPacket = new Uint8Array([...rawPacket, ...halfPacket]);

          try {
            fullRead += (await connection.read(halfPacket))!;
          } catch {
            await this.removeUser(
              connection,
              "Couldn't read all of packet " + packetID[0],
            );
            break;
          }
        }

        this.handlePacket(rawPacket, packetID[0], connection);
      } else {
        await this.removeUser(
          connection,
          "Packet ID read returned null. Packet " + packetID[0],
        );
        break;
      }
    }
  }
}
