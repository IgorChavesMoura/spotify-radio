import server from "./server/index.js";
import { logger } from "./util.js";
import config from "./config.js";

server.listen(config.port).on("listening", () => logger.info(`Server running at ${config.port}`));