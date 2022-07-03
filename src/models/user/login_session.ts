import { Document, Schema, model} from "mongoose";
import {ITEM_STATUS, STATUS} from "../constants/AppConstants";

const LoginSessionSchema = new Schema({
    uuid: { type: String, index: true, trim: true, required: true},
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User'},
    status: {type: Number, default: 0},
    expiry_date: {type: Date, default: Date.now() + 86400},
    logged_out: {type: Boolean, default: false},
    expired: {type: Boolean, default: true},
    os: { type: String},
    version: { type: String},
    device: { type: String},
}, 
{
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export interface ILoginSession extends Document {
    uuid: string,
    user: string,
    status: string,
    expiry_date: Date,
    logged_out: boolean,
    expired: boolean,
    os: string,
    version: string,
    device: string,
}

export default model<ILoginSession>("LoginSession", LoginSessionSchema);
