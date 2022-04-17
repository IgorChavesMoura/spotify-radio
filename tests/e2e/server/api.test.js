import { jest, expect, describe, test, beforeEach } from "@jest/globals";
import config from "../../../server/config.js";
import Server from "../../../server/server/index.js";
import superTest from "supertest";
import portfinder from "portfinder";
import { Transform } from "stream";
import { setTimeout } from "timers/promises";
import { readFileSync } from "fs";
import { join, extname } from "path";

const getAvailablePort = portfinder.getPortPromise;
const RETENTION_DATA_PERIOD = 200;
const {
  dir: { publicDir },
  pages: { homeHTML, controllerHTML },
  constants: { CONTENT_TYPE },
} = config;

describe("API E2E Suite Test", () => {
  const commandResponse = JSON.stringify({
    result: "ok",
  });
  const possibleCommands = {
    start: "start",
    stop: "stop",
  };

  function pipeAndReadStreamData(stream, onChunk) {
    const transform = new Transform({
      transform(chunk, enc, cb) {
        onChunk(chunk);

        cb(null, chunk);
      },
    });
    return stream.pipe(transform);
  }
  describe("client workflow", () => {
    async function getTestServer() {
      const getSupertTest = (port) => superTest(`http://localhost:${port}`);
      const port = await getAvailablePort();
      return new Promise((resolve, reject) => {
        const server = Server.listen(port)
          .once("listening", () => {
            const testServer = getSupertTest(port);
            const response = {
              testServer,
              kill() {
                server.close();
              },
            };

            return resolve(response);
          })
          .once("error", reject);
      });
    }

    function commandSender(testServer) {
      return {
        async send(command) {
          const response = await testServer.post("/controller").send({
            command,
          });

          expect(response.text).toStrictEqual(commandResponse);
        },
      };
    }
    test("it should redirect to /home if / is called with GET", async () => {
      const server = await getTestServer();
      await new Promise((resolve, reject) => {
        server.testServer.get("/").end((err, response) => {
          expect(response.status).toStrictEqual(302);
          expect(response.header.location).toStrictEqual("/home");
          resolve();
        });
      });
      server.kill();
    });
    test("it should return home html content if /home is called with GET", async () => {
      const server = await getTestServer();
      const homeHTMLContent = readFileSync(join(publicDir, homeHTML), {
        encoding: "utf-8",
      });
      await new Promise((resolve, reject) => {
        server.testServer.get("/home").end((err, response) => {
          expect(response.status).toStrictEqual(200);
          expect(response.text).toStrictEqual(homeHTMLContent);
          resolve();
        });
      });
      server.kill();
    });
    test("it should return controller html content if /controller is called with GET", async () => {
      const server = await getTestServer();
      const controllerHTMLContent = readFileSync(
        join(publicDir, controllerHTML),
        {
          encoding: "utf-8",
        }
      );
      await new Promise((resolve, reject) => {
        server.testServer.get("/controller").end((err, response) => {
          expect(response.status).toStrictEqual(200);
          expect(response.text).toStrictEqual(controllerHTMLContent);
          resolve();
        });
      });
      server.kill();
    });
    test("it should return <file> content if /<file> is called with GET", async () => {
      const server = await getTestServer();
      const file = "./home/js/animation.js";
      const fileExt = extname(file);
      const fileContent = readFileSync(join(publicDir, file), {
        encoding: "utf-8",
      });
      await new Promise((resolve, reject) => {
        server.testServer.get(`/${file}`).end((err, response) => {
          expect(response.header["content-type"]).toStrictEqual(
            CONTENT_TYPE[fileExt]
          );
          expect(response.text).toStrictEqual(fileContent);
          resolve();
        });
      });
      server.kill();
    });
    test("it should not receive data stream if the process is not playing", async () => {
      const server = await getTestServer();
      const onChunk = jest.fn();
      pipeAndReadStreamData(server.testServer.get("/stream"), onChunk);
      await setTimeout(RETENTION_DATA_PERIOD);
      server.kill();
      expect(onChunk).not.toHaveBeenCalled();
    });
    test("it should receive data stream if the process is playing", async () => {
      const server = await getTestServer();
      const onChunk = jest.fn();
      const { send } = commandSender(server.testServer);
      pipeAndReadStreamData(server.testServer.get("/stream"), onChunk);

      await send(possibleCommands.start);
      await setTimeout(RETENTION_DATA_PERIOD);
      await send(possibleCommands.stop);
      const [[buffer]] = onChunk.mock.calls;
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000);

      server.kill();
    });
  });
});
