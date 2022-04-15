import { describe, assertEquals, types, Account, run, Chain, it, beforeEach} from "../deps.ts";
import { CoreModel } from "../models/core.model.ts";
import { VrfModel } from "../models/vrf.model.ts";
import { Accounts, Context } from "../src/context.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let core: CoreModel;
let vrf: VrfModel;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  core = ctx.models.get(CoreModel);
  vrf = ctx.models.get(VrfModel);
});

describe("[CityCoin VRF]", () => {
  describe("VRF CONSISTENCY", () => {
    it("returns the same value from v1 and v2", () => {
      // arrange
      // act
      // assert
    });
  });
});