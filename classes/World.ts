import { gzip, ungzip } from "https://cdn.skypack.dev/pako";
import { s3 } from "../deps.ts";
import { Position } from "./classes.ts";

export class World {
  size: Position;
  data: Uint8Array;
  private dataView: DataView;
  name: string;
  // deno-lint-ignore no-explicit-any
  optionalJson: any = {};

  constructor(size: Position, name: string) {
    this.size = size;
    this.name = name;

    this.data = new Uint8Array(4 + size.x * size.y * size.z);
    this.dataView = new DataView(this.data.buffer);

    this.dataView.setInt32(0, this.size.x * this.size.y * this.size.z, false);

    this.load();
  }

  setBlock(pos: Position, block: number) {
    const szz = this.sizeToWorldSize(pos);

    this.dataView.setUint8(szz, block);
  }

  getBlock(pos: Position) {
    return this.dataView.getUint8(this.sizeToWorldSize(pos));
  }

  findID(block: number): Position[] {
    const position = [];
    for (let z = 0; z < this.size.z; z++) {
      for (let y = 0; y < this.size.y; y++) {
        for (let x = 0; x < this.size.x; x++) {
          if (this.getBlock({ z, y, x }) == block) {
            position.push({ z, y, x });
          }
        }
      }
    }
    return position;
  }

  private sizeToWorldSize(pos: Position): number {
    return 4 + pos.x + this.size.z * (pos.z + this.size.x * pos.y);
  }

  getSpawn(): Position {
    return {
      x: Math.floor(this.size.x / 2) * 32,
      y: (Math.floor(this.size.y / 2) * 32) + 32,
      z: Math.floor(this.size.z / 2) * 32,
    };
  }

  setLayer(y: number, type: number) {
    for (let i = 0; i < this.size.z; i += 1) {
      for (let b = 0; b < this.size.x; b += 1) {
        this.setBlock({
          x: b,
          y,
          z: i,
        }, type);
      }
    }
  }

  async delete() {
    try {
      await s3.deleteObject({
        Bucket: "cla66ic",
        Key: this.name + ".buf",
      });
    } catch {
      // doesn't exist, probably..
    }
  }
  private async load() {
    try {
      const head = await s3.headObject({
        Bucket: "cla66ic",
        Key: this.name + ".buf",
      });

      const ungziped = ungzip(
        (await s3.getObject({
          Bucket: "cla66ic",
          Key: this.name + ".buf",
        })).Body,
      );
      if (!(ungziped instanceof Uint8Array)) return;

      this.size = {
        x: +head.Metadata.x!,
        y: +head.Metadata.y!,
        z: +head.Metadata.z!,
      };

      this.data = ungziped;
      this.dataView = new DataView(this.data.buffer);
      this.optionalJson = JSON.parse(head.Metadata.json || "{}");
    } catch {
      const layers = Math.floor(this.size.y / 2);

      for (let i = 0; i < layers; i += 1) {
        if (i === layers - 1) {
          this.setLayer(layers - 1, 2);
        } else {
          this.setLayer(i, 1);
        }
      }
    }
  }

  async save() {
    await s3.putObject({
      Bucket: "cla66ic",
      Key: this.name + ".buf",
      Body: gzip(this.data),
      Metadata: {
        "x": this.size.x + "",
        "y": this.size.y + "",
        "z": this.size.z + "",
        "json": JSON.stringify(this.optionalJson),
      },
    });
  }
}
