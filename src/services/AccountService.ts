import RandomString, { GenerateOptions } from 'randomstring';
import bcrypt = require('bcryptjs');
import Jwt from "jsonwebtoken";
import { v4 as uuidv4 } from 'uuid';
import {ILoginSession} from "../models/user/login_session";
import { Request } from 'express';

class AccountService {


    public generateUUIDV4() {
        return uuidv4();
    }

    public static generateUUIDV4Static() {
        return uuidv4();
    }

    public getCode(length:number = 6, capitalize:boolean = false) {
        const options:GenerateOptions = {
            length: length,
            readable: true,
            charset: "alphanumeric",
        }
        if (capitalize) {
            options.capitalization = "uppercase";
        }
        return RandomString.generate(options);
    }

    public generateOTP(length:number = 6) {

        if (process.env.ENVIRONMENT == 'dev') {
            return "123456";
        }
        return this.getCode(length);
    }

    public getNumberCode(length:number = 6) {

        const options = {
            length: length,
            charset: "numeric"
        }
        return RandomString.generate(options);
    }

    public getAlphaCode(length:number = 6, capitalize:boolean = false) {
        const options:GenerateOptions = {
            length: length,
            charset: 'alphabetic'
        }
        if (capitalize) {
            options.capitalization = "uppercase";
        }
        return RandomString.generate(options);
    }

    public createLoginToken(loginSession: ILoginSession) {
        const data: any = {user: loginSession.user, uuid: loginSession.uuid};
        return Jwt.sign({ data: data}, process.env.APP_SECRET!, { expiresIn: '24h' });
    }

    public verifyToken(token: string, callback:(err:any, decoded:any) => void) {

        Jwt.verify(token, process.env.APP_SECRET!, (err, decoded) => {
            callback(err, decoded);
        });
    }

    public verifyTokenAsync(token: string) {
        return new Promise((resolve, reject) => {
            Jwt.verify(token, process.env.APP_SECRET!, function(err, decoded) {
                if (err) {
                    reject(err)
                } else {
                    resolve(decoded);
                }
            });
        });
    }
    
    createDefaultPassword() {
        return (process.env.ENVIRONMENT === "dev")? "password" : this.getCode();
    }

    public getSalt() {
        return bcrypt.genSaltSync(10);
    }

    public hashPassword(password:string, salt:string) {
        return bcrypt.hashSync(password, salt);
    }

    getTokenFromRequest(req: Request) {
        const payload = req.headers.authorization || "";
        let jwt = "";
        if (payload) {
            if (payload.split(" ").length > 1) {
                jwt = payload.split(" ")[1];
                return jwt;
            }
        }
        return jwt;
    }
}

export default AccountService;
