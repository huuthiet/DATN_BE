// Library
import { prop, Ref, Typegoose } from "../../libs/typegoose/typegoose";

// Models
import { Basic } from "../basic";
import { User } from "../user";
import { Job } from "./job";
import { Image } from "../image";

enum VnpayStatus {
  unpaid = "Chưa thanh tóan",
  paid = "Đã thanh toán",
  paidError = "Thanh toán lỗi",
}

enum PaymentType {
  deposit = "deposit",
  afterCheckInCost = "afterCheckInCost",
  monthly = "monthly",
  recharge = "recharge",
}

enum PaymentMethod {
  cash = "cash",
  vnpay = "vnpay",
  internal = "internal",
}

export class Order extends Basic {
  @prop({ ref: User })
  user: Ref<User>;

  @prop({ ref: Job })
  job?: Ref<Job>;

  @prop({ default: false })
  isCompleted: boolean;

  @prop()
  description?: string;

  @prop({ default: 0 })
  amount: number;

  @prop({ default: 0 })
  electricPrice: number;

  @prop({ default: 0 })
  electricNumber: number;

  @prop()
  type: PaymentType;

  @prop({ default: "Chưa thanh toán" })
  vnpayStatus: VnpayStatus;

  @prop({ default: "none" })
  paymentMethod: PaymentMethod;

  @prop({ ref: Image })
  UNC?: Ref<Image>;
}

export const OrderModel = (connection) => {
  return new Order().getModelForClass(Order, {
    existingConnection: connection,
    schemaOptions: {
      collection: "orders",
      timestamps: true,
    },
  });
};
