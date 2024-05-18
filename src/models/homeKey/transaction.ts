// Library
import { prop, Ref, Typegoose } from "../../libs/typegoose/typegoose";

// Models
import { Basic } from "../basic";
import { User } from "../user";
import { Image } from "../image";
import { Order } from "./order";
import { MotelRoom } from "./motelRoom";
import { Banking } from "./bank";
import { Room } from "./room";
enum PaymentMethod {
  cash = "cash",
  banking = "banking",
  momo = "momo",
  vnpay = "vnpay",
  internal = "internal",
  wallet = "wallet"
}

enum PaymentType {
  deposit = "deposit",
  afterCheckInCost = "afterCheckInCost",
  monthly = "monthly",
  recharge = "recharge",
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

  @prop()
  order?: Ref<Order>; //->job->room->floor->motel->
  
  @prop()
  banking?: Ref<Banking>; // tài khoản người nhận

  @prop({default: "none"})
  type: PaymentType;

  @prop()
  motel: Ref<MotelRoom>; // để query theo tòa nhanh

  @prop()
  room: Ref<Room>; // để query theo tòa nhanh
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
