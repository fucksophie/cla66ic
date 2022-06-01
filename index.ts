import { config } from "./deps.ts";
import { Server } from "./classes/Server.ts";

const server = new Server();

await server.start(config.port);
