// Library
import { prop, Ref, Typegoose } from "../../libs/typegoose/typegoose";

// Models
import { Basic } from "../basic";
import { User } from "../user";
import { Image } from "../image";
enum PaymentMethod {
  cash = "cash",
  banking = "banking",
  momo = "momo",
  vnpay = "vnpay",
  internal = "internal",
}

enum StatusTransactions {
  waiting = "waiting",
  success = "success",
  faild = "faild",
  cancel = "cancel",
}

export class Transactions extends Basic {
  @prop({ ref: User })
  user: Ref<User>;

  @prop({ default: "Mã thanh toán" })
  keyPayment: string;

  @prop()
  description?: string;

  @prop({ default: 0 })
  amount: number;

  @prop()
  status: StatusTransactions;

  @prop({ default: "none" })
  paymentMethod: PaymentMethod;

  @prop({ ref: Image })
  file?: Ref<Image>;
}

export const TransactionsModel = (connection) => {
  return new Transactions().getModelForClass(Transactions, {
    existingConnection: connection,
    schemaOptions: {
      collection: "transactions",
      timestamps: true,
    },
  });
};
