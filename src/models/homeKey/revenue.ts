import { prop, Ref } from "../../libs/typegoose/typegoose";
import { Basic } from "../basic";
import { User } from "../user";

class MotelRevenue {
    @prop()
    motelId: string;

    @prop()
    motelName: string;

    @prop()
    revenue: number;
}

export class Revenue extends Basic {
    @prop({ ref: () => User })
    hostId: Ref<User>;

    @prop()
    hostName: string;

    @prop({ type: () => [MotelRevenue] })
    motels: MotelRevenue[];

    @prop()
    timePeriod: string;

    @prop()
    date: Date;
}

export const RevenueModel = (connection) => {
    return new Revenue().getModelForClass(Revenue, {
        existingConnection: connection,
        schemaOptions: {
            timestamps: true,
            collection: "revenue",
        },
    });
};
