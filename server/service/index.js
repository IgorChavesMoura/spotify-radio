import fs from "fs";
import path, { join, extname } from "path";
import { randomUUID } from "crypto";
import fsPromises from "fs/promises";
import streamsPromises from "stream/promises";
import { once } from "events";
import { PassThrough, Writable } from "stream";
import Throttle from "throttle";
import childProcess from "child_process";
import config from "../config.js";
import { logger } from "../util.js";

const {
  dir: { publicDir, fxDir },
  constants: {
    fallbackBitRate,
    englishConversation,
    bitRateDivisor,
    audioMediaType,
    songVolume,
    fxVolume,
  },
} = config;

export class Service {
  constructor() {
    this.clientStreams = new Map();
    this.currentSong = englishConversation;
    this.currentBitRate = 0;
    this.throttleTransform = {};
    this.currentReadable = {};
  }

  createClientStream() {
    const id = randomUUID();
    const clientStream = new PassThrough();
    this.clientStreams.set(id, clientStream);

    return {
      id,
      clientStream,
    };
  }

  removeClientStream(id) {
    this.clientStreams.delete(id);
  }

  createFileStream(filename) {
    return fs.createReadStream(filename);
  }

  _executeSoxCommand(args) {
    return childProcess.spawn("sox", args);
  }

  async getBitRate(song) {
    try {
      const args = [
        "--i", // info
        "-B", // bitrate
        song,
      ];

      const { stderr, stdout } = this._executeSoxCommand(args);

      await Promise.all([once(stdout, "readable"), once(stderr, "readable")]);

      const [success, error] = [stdout, stderr].map((stream) => stream.read());

      if (error) return Promise.reject(error);

      return success.toString().trim().replace(/k/, "000");
    } catch (error) {
      logger.error(`Something went bad with bitrate: ${error}`);
      return fallbackBitRate;
    }
  }

  broadcast() {
    return new Writable({
      write: (chunk, enc, cb) => {
        for (const [id, stream] of this.clientStreams) {
          if (stream.writableEnded) {
            this.clientStreams.delete(id);
            continue;
          }
          stream.write(chunk);
        }

        cb();
      },
    });
  }

  async startStreamming() {
    logger.info(`Starting with ${this.currentSong}`);
    const bitRate = (this.currentBitRate =
      (await this.getBitRate(this.currentSong)) / bitRateDivisor);
    const throttleTransform = (this.throttleTransform = new Throttle(bitRate));
    const songReadable =
      (this.currentReadable =
      this.songReadable =
        this.createFileStream(this.currentSong));
    return streamsPromises.pipeline(
      songReadable,
      throttleTransform,
      this.broadcast()
    );
  }

  stopStreamming() {
    this.throttleTransform?.end?.();
  }

  async getFileInfo(file) {
    const fullFilePath = join(publicDir, file);

    // Check if file exists, throw an error if it doesn't
    await fsPromises.access(fullFilePath);

    const fileType = extname(fullFilePath);

    return {
      type: fileType,
      name: fullFilePath,
    };
  }

  async getFileStream(file) {
    const { name, type } = await this.getFileInfo(file);

    return {
      stream: this.createFileStream(name),
      type,
    };
  }

  async readFxByName(fxName) {
    const songs = await fsPromises.readdir(fxDir);
    const chosenSong = songs.find((filename) =>
      filename.toLowerCase().includes(fxName)
    );
    if (!chosenSong) return Promise.reject(`The sons ${fxName} wasn't found`);

    return path.join(fxDir, chosenSong);
  }

  appendFxStream(fx) {
    const throttleTransformable = new Throttle(this.currentBitRate);
    streamsPromises.pipeline(throttleTransformable, this.broadcast());

    const unpipe = () => {
      const transformStream = this.mergeAudioStreams(fx, this.currentReadable);
      this.throttleTransform = throttleTransformable;
      this.currentReadable = transformStream;
      this.currentReadable.removeListener("unpipe", unpipe);

      streamsPromises.pipeline(transformStream, throttleTransformable);
    };

    this.throttleTransform.on("unpipe", unpipe);
    this.throttleTransform.pause();
    this.currentReadable.unpipe(this.throttleTransform);
  }

  mergeAudioStreams(song, readable) {
    const transformStream = new PassThrough();
    const args = [
      "-t",
      audioMediaType,
      "-v",
      songVolume,
      "-m",
      "-",
      "-t",
      audioMediaType,
      "-v",
      fxVolume,
      song,
      "-t",
      audioMediaType,
      "-",
    ];

    const { stdout, stdin } = this._executeSoxCommand(args);

    //Plugs the conversation stream to terminal's data input
    streamsPromises.pipeline(readable, stdin);

    streamsPromises.pipeline(stdout, transformStream);

    return transformStream;
  }
}
