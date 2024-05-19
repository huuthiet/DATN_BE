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
  amount: number; // tổng tất cả

  @prop({ default: 0 })
  numberDayStay: number;

  @prop({ default: 0 })
  roomPrice: number;

  @prop({ default: 0 })
  electricNumber: number; // số kí điện sử dụng

  @prop({ default: 0 })
  electricPrice: number; // tổng tiền điện

  @prop({ default: 0 })
  waterPrice: number;  // (price x person)/(số ngày của tháng) x (số ngày ở)

  @prop({ default: 0 })
  servicePrice: number; // (price)/(số ngày của tháng) x (số ngày ở)

  @prop({ default: 0 })
  vehiclePrice: number; // (price x vihicle)/(số ngày của tháng) x (số ngày ở)

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
