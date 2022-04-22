import { describe, assertEquals, types, Account, run, Chain, it, beforeEach} from "../../../../deps.ts";
import { SendManyRecord, MiamiCoinTokenModelV2 } from "../../../../models/miamicoin-token-v2.model.ts";
import { Accounts, Context } from "../../../../src/context.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let tokenV2: MiamiCoinTokenModelV2;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  tokenV2 = ctx.models.get(MiamiCoinTokenModelV2, "miamicoin-token-v2");
})

describe("[MiamiCoin Token v2]", () => {
  //////////////////////////////////////////////////
  // SEND-MANY
  //////////////////////////////////////////////////
  describe("SEND-MANY", () => {
    describe("send-many()", () => {
      it("fails with (err u1) if sender does not have enough CityCoins", () => {
        // arrange
        const from = accounts.get("wallet_1")!;
        const recipients: Array<Account> = [
          accounts.get("wallet_2")!,
          accounts.get("wallet_3")!,
          accounts.get("wallet_4")!,
          accounts.get("wallet_5")!,
          accounts.get("wallet_6")!,
        ];
        const amounts: Array<number> = [100, 200, 300, 400, 500];
        const memos: Array<ArrayBuffer> = [
          new TextEncoder().encode("MiamiCoin is the first CityCoin"),
          new TextEncoder().encode("The Capitol of Capital"),
          new TextEncoder().encode("Support your favorite cities"),
          new TextEncoder().encode("Revolutionizing Civic Engagement"),
          new TextEncoder().encode("Built on Stacks Secured by Bitcoin"),
        ];

        const sendManyRecords: SendManyRecord[] = [];

        recipients.forEach((recipient, recipientIdx) => {
          let record = new SendManyRecord(
            recipient,
            amounts[recipientIdx],
            memos[recipientIdx]
          );
          sendManyRecords.push(record);
        });

        const amountTotal = sendManyRecords.reduce(
          (sum, record) => sum + record.amount,
          0
        );

        chain.mineBlock([tokenV2.testMint(amountTotal - 1, from)]);

        // act
        const receipt = chain.mineBlock([
          tokenV2.sendMany(sendManyRecords, from),
        ]).receipts[0];

        // assert
        receipt.result.expectErr().expectUint(1);
      });
      it("succeeds with five ft_transfer_events and five print memo events with memo supplied", () => {
        // arrange
        const from = accounts.get("wallet_1")!;

        const recipients: Array<Account> = [
          accounts.get("wallet_2")!,
          accounts.get("wallet_3")!,
          accounts.get("wallet_4")!,
          accounts.get("wallet_5")!,
          accounts.get("wallet_6")!,
        ];
        const amounts: Array<number> = [100, 200, 300, 400, 500];
        const memos: Array<ArrayBuffer> = [
          new TextEncoder().encode("MiamiCoin is the first CityCoin"),
          new TextEncoder().encode("The Capitol of Capital"),
          new TextEncoder().encode("Support your favorite cities"),
          new TextEncoder().encode("Revolutionizing Civic Engagement"),
          new TextEncoder().encode("Built on Stacks Secured by Bitcoin"),
        ];

        const sendManyRecords: SendManyRecord[] = [];

        recipients.forEach((recipient, recipientIdx) => {
          let record = new SendManyRecord(
            recipient,
            amounts[recipientIdx],
            memos[recipientIdx]
          );
          sendManyRecords.push(record);
        });

        const amountTotal = sendManyRecords.reduce(
          (sum, record) => sum + record.amount,
          0
        );

        // act

        chain.mineBlock([tokenV2.testMint(amountTotal, from)]);

        const block = chain.mineBlock([
          tokenV2.sendMany(sendManyRecords, from),
        ]);

        // assert

        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk();

        const receipt = block.receipts[0];

        let sendManyIdx = 0;

        receipt.events.forEach((event, n) => {
          if (typeof sendManyRecords[sendManyIdx].memo !== "undefined") {
            receipt.events.expectPrintEvent(
              tokenV2.address,
              types.some(
                types.buff(<ArrayBuffer>sendManyRecords[sendManyIdx].memo)
              )
            );
          } else {
            receipt.events.expectFungibleTokenTransferEvent(
              sendManyRecords[sendManyIdx].amount,
              from.address,
              sendManyRecords[sendManyIdx].to.address,
              "miamicoin"
            );
          }

          if (!(n % 2 == 0)) {
            sendManyIdx++;
          }
        });

        assertEquals(receipt.events.length, sendManyRecords.length * 2);
      });

      it("succeeds with five ft_transfer_events with no memo supplied", () => {
        // arrange
        const from = accounts.get("wallet_1")!;

        const recipients: Array<Account> = [
          accounts.get("wallet_2")!,
          accounts.get("wallet_3")!,
          accounts.get("wallet_4")!,
          accounts.get("wallet_5")!,
          accounts.get("wallet_6")!,
        ];
        const amounts: Array<number> = [100, 200, 300, 400, 500];

        const sendManyRecords: SendManyRecord[] = [];

        recipients.forEach((recipient, recipientIdx) => {
          let record = new SendManyRecord(recipient, amounts[recipientIdx]);
          sendManyRecords.push(record);
        });

        const amountTotal = sendManyRecords.reduce(
          (sum, record) => sum + record.amount,
          0
        );

        // act

        chain.mineBlock([tokenV2.testMint(amountTotal, from)]);

        const block = chain.mineBlock([
          tokenV2.sendMany(sendManyRecords, from),
        ]);

        // assert

        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk();

        const receipt = block.receipts[0];

        let sendManyIdx = 0;

        receipt.events.forEach((event, n) => {
          if (typeof sendManyRecords[sendManyIdx].memo !== "undefined") {
            receipt.events.expectPrintEvent(
              tokenV2.address,
              types.some(
                types.buff(<ArrayBuffer>sendManyRecords[sendManyIdx].memo)
              )
            );
          } else {
            receipt.events.expectFungibleTokenTransferEvent(
              sendManyRecords[sendManyIdx].amount,
              from.address,
              sendManyRecords[sendManyIdx].to.address,
              "miamicoin"
            );
          }

          if (!(n % 2 == 0)) {
            sendManyIdx++;
          }
        });

        assertEquals(receipt.events.length, sendManyRecords.length);
      });

      it("succeeds with five ft_transfer_events and two print events if memo supplied", () => {
        // arrange
        const from = accounts.get("wallet_1")!;

        const recipients: Array<Account> = [
          accounts.get("wallet_2")!,
          accounts.get("wallet_3")!,
          accounts.get("wallet_4")!,
          accounts.get("wallet_5")!,
          accounts.get("wallet_6")!,
        ];
        const amounts: Array<number> = [100, 200, 300, 400, 500];
        const memos: Array<ArrayBuffer> = [
          new TextEncoder().encode("MiamiCoin is the first CityCoin"),
          new TextEncoder().encode("Support your favorite cities"),
        ];

        const sendManyRecords: SendManyRecord[] = [];

        recipients.forEach((recipient, recipientIdx) => {
          let record = new SendManyRecord(
            recipient,
            amounts[recipientIdx],
            memos[recipientIdx]
          );
          sendManyRecords.push(record);
        });

        const amountTotal = sendManyRecords.reduce(
          (sum, record) => sum + record.amount,
          0
        );

        // act

        chain.mineBlock([tokenV2.testMint(amountTotal, from)]);

        const block = chain.mineBlock([
          tokenV2.sendMany(sendManyRecords, from),
        ]);

        // assert

        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk();

        const receipt = block.receipts[0];

        let sendManyIdx = 0;

        receipt.events.forEach((event, n) => {
          if (typeof sendManyRecords[sendManyIdx].memo !== "undefined") {
            receipt.events.expectPrintEvent(
              tokenV2.address,
              types.some(
                types.buff(<ArrayBuffer>sendManyRecords[sendManyIdx].memo)
              )
            );
          } else {
            receipt.events.expectFungibleTokenTransferEvent(
              sendManyRecords[sendManyIdx].amount,
              from.address,
              sendManyRecords[sendManyIdx].to.address,
              "miamicoin"
            );
          }

          if (!(n % 2 == 0)) {
            sendManyIdx++;
          }
        });

        assertEquals(
          receipt.events.length,
          sendManyRecords.length + memos.length
        );
      });
    });
  });
});

//////////////////////////////////////////////////
// expectPrintEvent()
//////////////////////////////////////////////////

declare global {
  interface Array<T> {
    expectPrintEvent(contract_identifier: string, value: string): Object;
  }
}

Array.prototype.expectPrintEvent = function (
  contract_identifier: string,
  value: string
) {
  for (let event of this) {
    try {
      let e: any = {};
      e["contract_identifier"] =
        event.contract_event.contract_identifier.expectPrincipal(
          contract_identifier
        );

      if (event.contract_event.topic.endsWith("print")) {
        e["topic"] = event.contract_event.topic;
      } else {
        continue;
      }

      if (event.contract_event.value.endsWith(value)) {
        e["value"] = event.contract_event.value;
      } else {
        continue;
      }
      return e;
    } catch (error) {
      continue;
    }
  }
  throw new Error(`Unable to retrieve expected PrintEvent`);
};

run();
