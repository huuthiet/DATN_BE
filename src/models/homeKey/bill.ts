// Library
import { prop, Ref } from "../../libs/typegoose/typegoose";

// Models
import { Basic } from "../basic";
import { OptionsType } from "./optionsType";
import { User } from "../user";

export class Bill extends Basic {
  @prop()
  idBill?: string;

  @prop()
  dateBill?: string;

  @prop()
  nameMotel?: string;

  @prop()
  nameRoom?: string;

  @prop()
  nameUser?: string;

  @prop()
  phoneUser?: string;

  @prop()
  address?: string;

  @prop()
  imgRoom?: string;

  @prop()
  emailOwner?: string;

  @prop()
  totalAll?: string;

  @prop()
  totalAndTaxAll?: string;

  @prop()
  totalTaxAll?: string;

  @prop()
  typeTaxAll?: string;

  @prop({ ref: OptionsType })
  electricity: Ref<OptionsType>;

  @prop({ ref: OptionsType })
  garbage: Ref<OptionsType>;

  @prop({ ref: OptionsType })
  water: Ref<OptionsType>;

  @prop({ ref: OptionsType })
  wifi: Ref<OptionsType>;

  @prop({ ref: OptionsType })
  other: Ref<OptionsType>;

  @prop({ ref: OptionsType })
  room: Ref<OptionsType>;

  @prop({ ref: User })
  user: Ref<User>;
}

export const BillModel = (connection) => {
  return new Bill().getModelForClass(Bill, {
    existingConnection: connection,
    schemaOptions: {
      collection: "bills",
      timestamps: true,
    },
  });
};
