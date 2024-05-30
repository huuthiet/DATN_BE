import { prop, Ref, pre, arrayProp } from '../../libs/typegoose/typegoose';

import { Basic } from '../basic';
import { User } from '../user';

export class Revenue extends Basic {
    @prop({ ref: User })
    hostId: Ref<User>;

    @prop()
    revenue: number;

    @prop()
    date: Date;
}
//   isPaid: boolean;
//
//   @prop({ default: false })
//   isDeleted: boolean;

export const RevenueModel = (connection) => {
    return new Revenue().getModelForClass(Revenue, {
        existingConnection: connection,
        schemaOptions: {
            collection: "revenue",
            timestamps: true
        }
    });
}