import BagahBot from "./src/BagahBot.js";
import Logger from "./src/utils/logger.js";

const bot = new BagahBot();

bot.start().catch((error) => {
  Logger.error("Fatal error starting bot:", error);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  Logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  Logger.error("Unhandled Rejection:", error);
});
