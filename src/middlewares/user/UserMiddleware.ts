import { v4 as uuidv4 } from 'uuid';
import axios from "axios";
// const axios = require('axios').default;
import AccountService from "../../services/AccountService";
import BaseRouterMiddleware from "../BaseRouterMiddleware";
import {
    ACTIVATION_CODE_LABEL,
    ACTIVATION_REQUEST_TYPE,
    BENEFICIARY_LABEL, CURRENT_USER_LABEL,
    ITEM_STATUS,
    ORGANISATION_LABEL,
    STORE_LABEL, STORE_TYPES, TEMP_PASSWORD_LABEL,
    USER_LABEL,
    VERIFY_CONTEXT, VERIFY_CHANNEL, BVN_DETAILS, SMS_VERIFICATION_LABEL
} from '../../constants/AppConstants';
import { Request, Response, Router } from 'express';
import LoginSessionService from '../../services/LoginSessionService';

class UserMiddleware extends BaseRouterMiddleware {

    private accountService: AccountService;
    private loginSessionService: LoginSessionService;



    constructor(appRouter:Router) {
        super(appRouter)
    }

    protected initServices() {
        this.accountService = new AccountService();
        this.loginSessionService = new LoginSessionService();

    }

    public ensureEmailIsUnique = (req:Request, res:Response, next:any) => {
        const email = req.body.email;
        if (!email) {
            return this.sendErrorResponse(res, new Error("email is required"), this.responseMessage.EMAIL_REQUIRED, 400)
        }

        this.userService.find({email: email})
            .then((user) => {
                return this.sendErrorResponse(res, this.responseMessage.DUPLICATE_EMAIL, {}, 400);
                next();
            })
            .catch((err) => {
                this.logAndSendErrorResponseObject(res, err, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400);
            })
    }

    public loadUserToRequestByEmail = (req, res, next) => {
        if (!req.body.email) {
            const message = Object.assign({}, this.responseMessage.UNABLE_COMPLETE_REQUEST, {message: "username is required"});
            return this.logAndSendErrorResponseObject(res, message, message, 400)
        }
        const email = req.body.email;
        this.userService.findByEmail(email)
            .then((user) => {
            this.requestService.addToDataBag(USER_LABEL, user);
            next();
        })
            .catch((err) => {
                next();
            })
    }

    public loadUserToRequestByEmailOrPhone = (req, res, next) => {
        if (!req.body.email) {
            const message = Object.assign({}, this.responseMessage.UNABLE_COMPLETE_REQUEST, {message: "username is required"});
            return this.logAndSendErrorResponseObject(res, message, message, 400)
        }
        const email = req.body.email;
        this.userService.findOne({$or: [{email: email}, {phone: email}]})
            .then((user) => {
                this.requestService.addToDataBag(USER_LABEL, user);
                next();
            })
            .catch((err) => {
                next();
            })
    }

    public loadNamesFromRequest = (req, res, next) => {
        const name = req.body.first_name;
        if (! name) {
            const message = Object.assign({}, this.responseMessage.UNABLE_COMPLETE_REQUEST, {message: "First name is required"});
            return this.logAndSendErrorResponseObject(res, message, message, 400);
        }
        const names = name.split(" ");
        if (names.length > 1) {
            req.body.first_name = names[0];
            req.body.last_name = names[1];
        } else {
            if (!req.body.last_name) {
                const message = Object.assign({}, this.responseMessage.UNABLE_COMPLETE_REQUEST, {message: "Last name is required"});
                return this.logAndSendErrorResponseObject(res, message, message, 400);
            }
        }
        next();
    }

    public checkUserStatus = (req, res, next) => {
        const user: any = this.requestService.getFromDataBag(USER_LABEL) || {};
        const status = user.status;
        switch(status) {
            case ITEM_STATUS.ACTIVE:
            case ITEM_STATUS.PENDING:
             return next();
            case ITEM_STATUS.SELF_DEACTIVATED:
            case ITEM_STATUS.SUSPENDED:
            case ITEM_STATUS.DEACTIVATED: {
               return this.sendErrorResponse(
                   res,
                   {success: false, error_code: 100, message: "verification error"},
                   {error_message: "ct admin"}
                   );
            }
            case null: {
                return this.logAndSendErrorResponseObject(res, {message: "invalid user status"}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 404)
            }
            default: return this.sendErrorResponse(
                res,
                {success: false, error_code: 100, message: "account not found"},
                {error_message: "Please contact admin"},
                404
            );
        }
    }

    public loadUserToRequestById = (req, res, next) => {
        const id = req.params.id || req.body.user_id || req.body.user;
        if(!id) {
            next();
        } else {
            this.userService.findById(id)
                .then((user) => {
                this.requestService.addToDataBag(USER_LABEL, user);
                next();
            })
                .catch((err) => {
                   return next();
                })
        }
    }

    public loadUserById = (req, res, next) => {
        const id = req.params.id || req.body.user_id || req.body.user;
        if(!id) {
            return this.logAndSendErrorResponseObject(res, {message: "User not found"}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 404)
        } else {
            this.userService.findById(id)
                .then((user) => {
                this.requestService.addToDataBag(CURRENT_USER_LABEL, user);
                next();
            })
                .catch((err) => {
                    return next();
                })
        }
    }

    public loadUserByIdForStore = (req, res, next) => {
        const id = req.params.id || req.body.user_id || req.body.user;
        const store = this.getLoggedInStore();
        if(!id) {
            return this.logAndSendErrorResponseObject(res, {message: "User Identifier not valid"}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 404)
        } else {
            this.userService.findOne({_id: id, store: store._id})
                .then((user) => {
                    if(!user) {
                        return this.logAndSendErrorResponseObject(res, {message: "User not found"}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 404)
                    }
                    this.requestService.addToDataBag(CURRENT_USER_LABEL, user);
                    next();
                })
                .catch((err) => {
                    return next();
                })
        }
    }

    public loadUserByIdForOrganisation = (req, res, next) => {
        const id = req.params.id || req.body.user_id || req.body.user;
        const org = this.getOrganisation();
        if(!id) {
            return this.logAndSendErrorResponseObject(res, {message: "User Identifier not valid"}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 404)
        } else {
            this.userService.findOne({_id: id, organisation: org._id})
                .then((user) => {
                    if(!user) {
                        return this.logAndSendErrorResponseObject(res, {message: "User not found"}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 404)
                    }
                    this.requestService.addToDataBag(CURRENT_USER_LABEL, user);
                    next();
                })
                .catch((err) => {
                    next();
                })
        }
    }

    public hashNewPassword = (req, res, next) => {
        if (req.body.password) {
            const salt = this.passwordService.getValidSalt();
            req.body.salt = salt;
            req.body.password = this.passwordService.hashPassword(req.body.password, salt);
            next();
        } else {
            return this.logAndSendErrorResponseObject(res, {message: "invalid password"}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400)
        }

    }

    public hashUserPassword = (req, res, next) => {
        const user = this.requestService.getUser();
        if (user && user.salt) {
            req.body.password = this.passwordService.hashPassword(req.body.password, user.salt);
            next();
        } else {
            return this.logAndSendErrorResponseObject(res, {message: "invalid salt"}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400);
        }

    }

    public hashAccountPin = (req, res, next) => {
        const user = this.requestService.getUser();
        const pin = req.body.account_pin || '';
        console.log(pin);
        if (pin.length != 4) {
            return this.logAndSendErrorResponseObject(res, {message: "invalid salt"}, this.responseMessage.INVALID_PIN_LENGTH, 400);
        }
        if (user && user.salt) {
            req.body.account_pin = this.passwordService.hashPassword(pin, user.salt);
            next();
        } else {
            return this.logAndSendErrorResponseObject(res, {message: "invalid salt"}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400);
        }
    }

    public hashAccountPinFromBody = (req, res, next) => {
        const pin = req.body.account_pin || '';
        console.log(pin);
        if (pin.length != 4) {
            return this.logAndSendErrorResponseObject(res, {message: "invalid salt"}, this.responseMessage.INVALID_PIN_LENGTH, 400);
        }
        if (req.body && req.body.salt) {
            req.body.account_pin = this.passwordService.hashPassword(pin, req.body.salt);
            next();
        } else {
            return this.logAndSendErrorResponseObject(res, {message: "invalid salt"}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400);
        }
    }

    public hashUserResetPassword = (req, res, next) => {
        const user = this.requestService.getUser();
        if (user && user.salt && req.body.password_reset) {
            req.body.password_reset = this.passwordService.hashPassword(req.body.password_reset, user.salt);
            next();
        } else {
            return this.logAndSendErrorResponseObject(res, {message: "invalid user state for reset password"}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400)
        }

    }

    public setActivationCode = (req, res, next) => {
        const code  = this.accountService.getNumberCode();
        //this.requestService.updateRequest('code', code, 'body');
        const str = `${Date.now()}`;
        req.body.code = code || str.substr(-6);
        next();
    }

    public setPasswordCode = (req, res, next) => {
        const code = this.accountService.getCode();
        this.requestService.updateRequest('code', code, 'body');
        next();
    }

    public tryCreateDefaultPassword = (req, res, next) => {
        if (!req.body.password) {
            const code = this.accountService.createDefaultPassword();
            this.requestService.addToDataBag(TEMP_PASSWORD_LABEL, code);
            req.body.password = code;
        }
        next();
    }

    public createAccountNumber = (req, res, next) => {
        const partA = Date.now();
        const remainingLength = 16 - (partA.toString().length);
        const partB = this.accountService.getNumberCode(remainingLength);
        const accountNumber = partA.toString() + partB.toString();

        Account.findOne({account_number: accountNumber})
            .then((account) => {
                if (account && account._id) {
                    return this.sendErrorResponse(res, this.responseMessage.ERROR, {message: "unable to create new account"});
                } else {
                    this.requestService.addToDataBag("account_number", accountNumber);
                    next();
                }
            })
            .catch((err) => {
                const message = Object.assign({}, this.responseMessage.ERROR, {message: "aborted, unable to create account"})
                return this.logAndSendErrorResponseObject(res, err, message, 400);
            });
    }

    public validateAccountNumber = (req, res, next) => {
        const accountNumber = this.requestService.getFromDataBag("account_number");
        Account.findOne({account_number: accountNumber})
            .then((account) => {
                if (account && account._id) {
                    const message = Object.assign({}, this.responseMessage.ERROR, {message: "aborted, unable to create account"})
                    return this.logAndSendErrorResponseObject(res, this.responseMessage.ACCOUNT_NUMBER_ERROR, message, 400);
                } else {
                    next();
                }
            })
            .catch((err) => {
                console.log(err);
                next();
            })
    }

    public validateAccountEmail = (req, res, next) => {
        const email = req.body.email;
        User.findOne({email: email})
            .then((user) => {
                if (user && user._id) {
                    return this.sendErrorResponse(res, this.responseMessage.DUPLICATE_EMAIL, {error_message: "Please try a different email"});
                } else {
                    next();
                }
            })
            .catch((err) => {
                const message = Object.assign({}, this.responseMessage.ERROR, {message: "Error, unable to create account"})
                return this.logAndSendErrorResponseObject(res, err, message, 400);
            })
    }

    public validateAccountPhone = (req, res, next) => {
        const phone = req.body.phone;
        User.findOne({phone: phone})
            .then((user) => {
                if (user && user._id) {
                    return this.sendErrorResponse(res, this.responseMessage.DUPLICATE_PHONE, {error_message: "Please try a different phone number"});
                } else {
                    next();
                }
            })
            .catch((err) => {
                const message = Object.assign({}, this.responseMessage.ERROR, {message: "Error, unable to create account"})
                return this.logAndSendErrorResponseObject(res, err, message, 400);
            })
    }

    public userExists = (req, res, next) => {
        const user = this.requestService.getUser();
        if (user && user._id != null) {
            next();
        } else {
            const message = {success: false, error_code: 404, message: "user not found in request"} ;
            this.logAndSendErrorResponseObject(res, message,{success: false, error_code: 404, message: message.message}, 404);
        }
    }

    //@deprecated
    public loadPermission = (req, res, next) => {
        const user = this.requestService.getUser();
        this.userService.findSystemsUser(user._id)
            .then((user) => {
                this.requestService.addToDataBag('sys_user', user);
                next();
            })
            .catch((err) => {
            next();
        })
    }

    public createLoginVerificationCode = (req, res, next) => {
        const user = this.requestService.getUser();
        const data = {
            token: this.accountService.generateUUIDV4(),
            code: this.accountService.getNumberCode(),
            user: user._id,
            name: ACTIVATION_REQUEST_TYPE.LOGIN_2FA
        }
        this.loginSessionService.create(data)
            .then((activation) => {
                this.requestService.addToDataBag('activation_code', activation);
                next();
            })
            .catch((err) => {
                next();
            })
    }

    public createBeneficiaryVerificationCode = (req, res, next) => {
        if (req.body.ignore_code) {
            return next();
        }
        const user = this.requestService.getUser();
        const store = this.requestService.getFromDataBag(STORE_LABEL);
        const organisation = this.requestService.getOrganisation();
        const beneficiary = this.requestService.getFromDataBag(BENEFICIARY_LABEL);
        const app = this.requestService.getApplication();
        const data = {
            token: this.accountService.generateUUIDV4(),
            code: this.accountService.getNumberCode(),
            user: user._id,
            name: ACTIVATION_REQUEST_TYPE.BENEFICIARY_SETUP,
            store: store?._id,
            organisation: organisation?._id || store?.organisation,
            app: app?._id, //for queue
        }
        this.loginSessionService.create(data)
            .then((activation) => {
                this.requestService.addToDataBag(ACTIVATION_CODE_LABEL, activation);
                next();
            })
            .catch((err) => {
                next();
            })
    }

    public getActivationTokenFromBody = (req, res, next) => {
        const token = req.body.token;
        console.log(req.body);
        if (req.body.ignore_token) {
            return next();
        }

        this.loginSessionService.findByToken(token)
            .then((activation) => {
                if (activation) {
                    this.requestService.addToDataBag(ACTIVATION_CODE_LABEL, activation);
                    next();
                } else {
                    const message = {success: false, error_code: 404, message: "unable to complete reset request: Activation code error"} ;
                    return this.logAndSendErrorResponseObject(res, message,{success: false, error_code: 404, message: message.message}, 404);
                }

            })
            .catch((err) => {
                const message = {success: false, error_code: 404, message: "user not found in request"} ;
                return this.logAndSendErrorResponseObject(res, err,{success: false, error_code: 404, message: message.message}, 404);
            })
    }

    public getActivationTokenFromBodyOrNew = (req, res, next) => {
        const token = req.body.token;
        this.loginSessionService.findByToken(token)
            .then((activation) => {
                if (activation) {
                    this.requestService.addToDataBag(ACTIVATION_CODE_LABEL, activation);
                    next();
                } else {
                    return this.createLoginVerificationCode(req, res, next);
                }

            })
            .catch((err) => {
                const message = {success: false, error_code: 404, message: "user not found in request"} ;
                this.logAndSendErrorResponseObject(res, err,{success: false, error_code: 404, message: message.message}, 404);
            })
    }

    public verifyOTP = (req, res, next) => {
        const user = this.requestService.getUser();
        const code = req.body.code;
        const activationCode: IActivationCode = this.requestService.getFromDataBag(ACTIVATION_CODE_LABEL);
        if (this.userService.validateActivationCode(activationCode, code, user)) {
          //  next();
            this.loginSessionService.updateStatus(activationCode._id)
                .then((a) => {
                    return next();
                })
                .catch((err) => {
                    return this.logAndSendErrorResponseObject(res, err, this.responseMessage.INCORRECT_OTP, 400);
                })
        } else {
            return this.logAndSendErrorResponseObject(res, {message: this.responseMessage.INCORRECT_OTP + ' for user' + user?._id}, this.responseMessage.INCORRECT_OTP, 400);
        }
    }

    public verifyOTPNoUpdate = (req, res, next) => {
        const user = this.requestService.getUser();
        const code = req.body.code;
        const activationCode: IActivationCode = this.requestService.getFromDataBag(ACTIVATION_CODE_LABEL);
        if (this.userService.validateActivationCode(activationCode, code, user)) {
            next();
        } else {
            return this.logAndSendErrorResponseObject(res, {message: this.responseMessage.INCORRECT_OTP + ' for user' + user?._id}, this.responseMessage.INCORRECT_OTP, 400);
        }
    }

    public verifyOTPPIN = (req, res, next) => {
        const user = this.requestService.getUser();
        const code = req.body.code || '0';
        const hashedCode = this.passwordService.hashPassword(code, user.salt);
        if (hashedCode === user.account_pin) {
                next();
        } else {
            return this.logAndSendErrorResponseObject(res, {message: this.responseMessage.INCORRECT_OTP + ' for user' + user?._id}, this.responseMessage.INCORRECT_OTP, 400);
        }
    }

    public verifyAndLoadOrganisation = async (req, res, next) => {
        const user = this.requestService.getUser();
        try {
            const orgCode = req.params.orgCode || req.body.org_code;
            if (orgCode) {
                const organisation = await this.organisationService.findByCode(orgCode);
                if (!organisation) {
                    throw  new Error('organisation not founds for code ' + orgCode);
                } else {
                    const isInScope = await this.sysUserService.isInAppScope(user._id, organisation._id);
                    if (!isInScope){
                        throw  new Error(`user ${user._id} not found in organisation scope  + ${orgCode}`);
                    } else {
                        this.requestService.addToDataBag(ORGANISATION_LABEL, organisation);
                        next();
                    }
                }
            } else {
                const organisation = await this.organisationService.findOne({user: user._id, status: ITEM_STATUS.ACTIVE});
                if (!organisation){
                    throw  new Error(`organisation not found for user  ${user._id}`);
                } else {
                    this.requestService.addToDataBag(ORGANISATION_LABEL, organisation);
                    next();
                }
            }
        } catch (err) {
            const message = {success: false, error_code: 404, message: "Organisation not found"} ;
            return this.logAndSendErrorResponseObject(res, err, message, 400);
        }
    }

    public trimPhoneAndEmail = (req, res, next) => {
        req.body.email = req.body.email?.replace(/ /g,'');
        req.body.phone = req.body.phone?.replace(/ /g,'');
        next();
    }

    public trimStorePhoneAndEmail = (req, res, next) => {
        req.body.store_email = req.body.store_email?.replace(/ /g,'');
        req.body.store_phone = req.body.store_phone?.replace(/ /g,'');
        next();
    }

    public checkRequestedComplianceDocument = async (req, res, next) => {
        const user = this.requestService.getUser();
        this.userDocumentService.findOne({user: user._id, status: {$in: [ITEM_STATUS.PENDING, ITEM_STATUS.ACTIVE]}})
            .then((doc) => {
                if (doc) {
                    const message = {success: false, error_code: 404, message: "Document required"} ;
                    return this.logAndSendErrorResponseObject(res, message, message, 417);
                } else {
                    next();
                }
            })
    }

    public passwordGate = (req, res, next) => {
        const user = this.requestService.getUser();
        const password = req.body.password;
        User.findOne({_id: user._id, password: password})
            .then((u) => {
                if (u) {
                    next();
                } else {
                    throw  new Error("Invalid password");
                }
            })
            .catch((err) => {
                const message = {success: false, error_code: 404, message: "Unable to validate user"} ;
                return this.logAndSendErrorResponseObject(res, err, message, 400);
            })
    }

    public makeMoneyAgentIfRequired = async (req, res, next) => {
        const type = req.body.store_type || req.headers['app-type'];
        if (req.body.is_money_agent || type == STORE_TYPES.MONEY_AGENT) {
            const org = await this.organisationService.findOne({name: process.env.DEFAULT_MONEY_AGENT_ORGANISATION});
            req.body.organisation = org?._id;
            next();
        } else {
            return next();
        }
    }

    public verifyCaptcha = (req, res, next) => {
        const response = req.body.captcha;
        console.log("BODY", req.body);
        if (!response) {
            return this.logAndSendErrorResponseObject(res, {message: "no captchar"}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400);
        }
        const path = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.CAPTCHA_SECRET}&response=${response}`;
        const postData = {
            secret: process.env.CAPTCHA_SECRET,
            response: response
        }
        console.log(postData)
        axios.post(path, {})
            .then((data) => {
                console.log(data, data.data);
                if (data.data.success) {
                    next();
                } else {
                    return this.logAndSendErrorResponseObject(res, {message: "captchar verification failed"}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400);
                }
            });
    }

    ensureOnlyAuthorised = (req, res, next) => {
        const user = this.requestService.getUser();
        if (user.email === 'vodiahco1@gmail.com' || user.email === 'info@moninetworks.com') {
            next();
        } else {
            const message = {success: false, error_code: 404, message: "You are NOT authorised to perform action"} ;
            return this.logAndSendErrorResponseObject(res, message, message, 400);
        }
    }

    isKyced = (req, res, next) => {
        const user = this.requestService.getUser();
        if (user.user_kyced) {
            next();
        } else {
            const message = {success: false, error_code: 400, message: "Please contact Admin regarding your KYC", error_message: "Please contact Admin regarding your KYC"} ;
            return this.logAndSendErrorResponseObject(res, message, message, 400);
        }
    }

    public checkUserHasSetBVN = (req, res, next) => {
        const user = this.requestService.getUser();
        const bvn = user.bvn;
        if (! bvn) {
            const message = Object.assign({}, this.responseMessage.UNABLE_COMPLETE_REQUEST, {message: "User has not set BVN on wallet"});
            return this.logAndSendErrorResponseObject(res, message, message, 400);
        }
        if (bvn !== req.body.bvn) {
            const message = Object.assign({}, this.responseMessage.UNABLE_COMPLETE_REQUEST, {message: "BVN does not match"});
            return this.logAndSendErrorResponseObject(res, message, message, 400);
        }
        next();
    }

    public createBVNVerificationCodeTwilio = async (req, res, next) => {
        const user = this.requestService.getUser();
        let service; // = await this.verifyServiceDataService.findOne({context: VERIFY_CONTEXT.LOGIN});
        if (!service) {
            try {
                const serviceObj: any = await this.twilioService.create({friendlyName: 'Moni wallet BVN'});
                if (serviceObj.sid) {
                    service = await this.verifyServiceDataService.create({
                        service_id: serviceObj.sid,
                        message: serviceObj.friendly_name,
                        context: VERIFY_CONTEXT.BVN
                    });
                }
            } catch (e) {
                console.log(e);
                return this.logAndSendErrorResponseObject(res, e, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400);
            }
        }
        if (!service) {
            return this.logAndSendErrorResponseObject(res, {message: "NO Verification service for twilio"}, this.responseMessage.UNABLE_TO_SAVE, 400);
        }
        const verification = await this.twilioService.send({
            sid: service.service_id,
            phone: req.body.phone,
            channel: VERIFY_CHANNEL.SMS
        })
        const data = {
            token: this.accountService.generateUUIDV4(),
            code: (process.env.ENVIRONMNENT == 'dev') ? '123456' : this.accountService.getNumberCode(),
            user: user._id,
            name: ACTIVATION_REQUEST_TYPE.BVN_VERIFICATION,
            data: service.service_id
        }
        await this.loginSessionService.updateMany({user: user._id, status: 0}, {status: 1});
        this.loginSessionService.create(data)
            .then((activation) => {
                this.requestService.addToDataBag('activation_code', activation);
                this.requestService.addToDataBag('verification_sms', verification);
                next();
            })
            .catch((err) => {
                console.log(err)
                next();
            })
    }

    public verifyOTPTwilio = async (req, res, next) => {
        const code = req.body.code;
        let activationCode: IActivationCode = this.requestService.getFromDataBag(ACTIVATION_CODE_LABEL);
        try {
            const verification: any = await this.twilioService.verify({
                sid: activationCode.data,
                phone: req.body.phone,
                code: code
            });
            console.log(req.body, verification);
            if (verification.status == 'approved') {
                await this.loginSessionService.updateStatus(activationCode._id);
                next();
            } else {
                return this.logAndSendErrorResponseObject(res, {}, this.responseMessage.INCORRECT_OTP, 400);
            }
        } catch (e) {
            this.logger.log(e);
            return this.logAndSendErrorResponseObject(res, {}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400);
        }
    }

    public getActivationTokenFromBodyTokenForTwilio = (req, res, next) => {
        const token = req.body.token;
        console.log(token)
        if (!token){
            return this.logAndSendErrorResponseObject(res, {}, this.responseMessage.INVALID_REQUEST, 400);
        }
        console.log(token)
        this.loginSessionService.findOneActive({token: token, data: {$ne: null}})
            .then((activation) => {
                this.requestService.addToDataBag(ACTIVATION_CODE_LABEL, activation);
                next();
            })
            .catch((err) => {
                next();
            })
    }

    public verifyBvn = async (req: any, res: any, next) => {
        //const user = this.requestService.getUser();
        // const userData = {
        //     first_name: "Aliyu",
        //     last_name: 'Gee',
        //     phone: '08144464318',
        //     bvn: '22390249577',
        //     middle_name: 'Henry',
        //     dob: '15/04/2022',
        //     response_message: 'success',
        //     response_code: 200,
        // };
        // this.requestService.addToDataBag(BVN_DETAILS, userData);
        // next()
        const bvn: any = req.body.bvn;
        console.log(bvn)
        if (bvn) {
            this.transferService.getBVNDetails({bvn: bvn})
                .then(async (dataResponse: any) => {
                    console.log('WENT THROUGH')
                    const bvnResponse = dataResponse.data;
                    console.log(bvnResponse);
                    if ("00" == bvnResponse.responseCode) {
                        const userData = {
                            first_name: bvnResponse.firstName,
                            last_name: bvnResponse.surname,
                            phone: bvnResponse.mobileNumber,
                            bvn: bvnResponse.bvn || bvn,
                            middle_name: bvnResponse.middleName,
                            dob: bvnResponse.dateOfBirth,
                            response_message: bvnResponse.responseMessage,
                            response_code: bvnResponse.responseCode,
                        };
                        console.log(userData);

                        try {
                            const bvnDetails = await this.bvnResponseService.create(userData);

                            this.requestService.addToDataBag(BVN_DETAILS, bvnDetails);
                            next()
                            //return this.sendSimpleSuccessResponse(res);

                        } catch (e) {
                            this.logAndSendErrorResponseObject(res, e, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400);
                        }
                    } else {
                        console.log("unable to process task for BVN", bvn);
                        this.logAndSendErrorResponseObject(res, {message: 'transaction not successful', transaction: bvnResponse}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400);
                    }
                });

        } else {
            console.log('FAILED THROUGH')
            console.log("unable to process task", bvn);
            return this.logAndSendErrorResponseObject(res, {message: 'transaction not successful', transaction: bvn}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400);
        }
    }

    public comparePhoneNum = (req, res, next) => {
        const user = this.requestService.getUser();
        const bvn_details = this.requestService.getFromDataBag(BVN_DETAILS);

        const inPutPhone = '0' + req.body.phone.substring(4)

        if (inPutPhone !== bvn_details.phone ){
            return this.logAndSendErrorResponseObject(res, {message: 'Phone number does not match BVN phone number'}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400);
        }
        next();
    }

    public checkNames = (req, res, next) => {
        const user = this.requestService.getUser();
        const bvn_details = this.requestService.getFromDataBag(BVN_DETAILS);

        if (user.first_name != bvn_details.first_name || user.last_name !== bvn_details.last_name ){
            return this.logAndSendErrorResponseObject(res, {message: 'Wallet names does not match BVN names'}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400);
        }
        next();
    }

    public createSignupVerificationCodeAfricasTalking = async (req, res, next) => {
        if (process.env.ENVIRONMNENT === 'dev') {
            const code = this.accountService.getNumberCode();
            const data = {
                token: uuidv4(),
                code: '123456',
                name: ACTIVATION_REQUEST_TYPE.ACCOUNT_ACTIVATION,
                data: code,
                phone: req.body.international_phone_number,
                platform: 'africastalking'
            };
            await this.loginSessionService.updateMany({phone: req.body.international_phone_number, status: 0}, {status: 1});
            this.loginSessionService.create(data)
                .then((activation) => {
                    this.requestService.addToDataBag(ACTIVATION_CODE_LABEL, activation);
                    this.requestService.addToDataBag(SMS_VERIFICATION_LABEL, {});
                    next();
                })
                .catch((err) => {
                    console.log(err)
                    next();
                })
        }
        if( req.body.country?.toLowerCase() == 'ng' && process.env.AFRICA_TALKING_ENABLED == 'yes') {
            const phone =  req.body.international_phone_number;
            const code = this.accountService.getNumberCode();
            const response: any = await this.africaSMSService.sendSMS(phone, code);
            const recipients = response?.Recipients;
            if (!recipients) {
                console.log("moving forward to twilio");
                return next();
            }
            const recipient = recipients[0];
            if (!recipient) {
                console.log("moving forward to twilio");
                return next();
            }
            if (recipient.statusCode != 100) {
                console.log("moving forward to twilio failed response " + recipient.statusCode);
                return next();
            }
            const data = {
                token: uuidv4(),
                code: (process.env.ENVIRONMNENT == 'dev') ? '123456' : this.accountService.getNumberCode(),
                name: ACTIVATION_REQUEST_TYPE.ACCOUNT_ACTIVATION,
                data: code,
                phone: req.body.international_phone_number,
                platform: 'africastalking'
            };
            await this.loginSessionService.updateMany({phone: req.body.international_phone_number, status: 0}, {status: 1});
            this.loginSessionService.create(data)
                .then((activation) => {
                    this.requestService.addToDataBag(ACTIVATION_CODE_LABEL, activation);
                    this.requestService.addToDataBag(SMS_VERIFICATION_LABEL, response);
                    next();
                })
                .catch((err) => {
                    console.log(err)
                    next();
                })
        } else {
            next();
        }
    }

    public createSignupVerificationCodeTwilio = async (req, res, next) => {
        console.log("on with twilio");
        const now = Date.now();
        let service; // = await this.verifyServiceDataService.findOne({context: VERIFY_CONTEXT.SIGNUP});
        //  console.log("Act", activation)
        const created = this.requestService.getFromDataBag(ACTIVATION_CODE_LABEL);
        if(created) {
            return next();
        } else {
            const activation = await this.loginSessionService.findOne({data: {$ne: null}, platform: {$nin: ['vonage', 'africastalking']}});
            console.log("moving forward with twilio");
            if (activation) {
                service = {service_id: activation.data}
            } else {
                try {
                    const serviceObj: any = await this.twilioService.create({friendlyName: 'MONI Networks Account Verification'});
                    if (serviceObj.sid) {
                        service = await this.verifyServiceDataService.create({
                            service_id: serviceObj.sid,
                            message: serviceObj.friendly_name,
                            context: VERIFY_CONTEXT.SIGNUP
                        });
                    }
                } catch (e) {

                    return  this.createVonageVerification(req, res, next);
                    //console.log(e);
                    // const message = Object.assign({}, this.responseMessage.UNABLE_COMPLETE_REQUEST, {message: 'Verify Service unavailable. try again'})
                    // return this.logAndSendErrorResponseObject(res, e, message, 400);
                }
            }
            if (!service) {
                return this.logAndSendErrorResponseObject(res, {message: "NO Verification service for twilio"}, this.responseMessage.UNABLE_TO_SAVE, 400);
            }

            let verification;
            try {
                verification = await this.twilioService.send({
                    sid: service.service_id,
                    phone: (process.env.ENVIRONMNENT == 'dev')? '+2348152229733' : req.body.international_phone_number,
                    channel: VERIFY_CHANNEL.SMS
                });
                //  console.log(verification)
            } catch (e) {
                console.log(e);
            }
            const data = {
                token: uuidv4(),
                code: (process.env.ENVIRONMNENT == 'dev') ? '123456' : this.accountService.getNumberCode(),
                name: ACTIVATION_REQUEST_TYPE.ACCOUNT_ACTIVATION,
                data: service.service_id,
                phone: req.body.international_phone_number,
                platform: 'twilio'
            };
            await this.loginSessionService.updateMany({phone: req.body.international_phone_number, status: 0}, {status: 1});
            this.loginSessionService.create(data)
                .then((activation) => {
                    this.requestService.addToDataBag(ACTIVATION_CODE_LABEL, activation);
                    this.requestService.addToDataBag(SMS_VERIFICATION_LABEL, verification);
                    next();
                })
                .catch((err) => {
                    console.log(err)
                    next();
                })

        }
    }

    public createVonageVerification = (req, res, next) => {
        const Vonage = require('@vonage/server-sdk');
        const vonage = new Vonage({
            apiKey: process.env.VONAGE_API_KEY,
            apiSecret: process.env.VONAGE_SECRET
        });
        const number = req.body.international_phone_number;
        const num = number.replace(/\D/g,'');
        console.log(num)
        vonage.verify.request({
            number: num,
            brand: "House24",
            code_length: 6
        }, async (err, result) => {
            if (err) {
                console.error(err);
            } else {
                const verifyRequestId = result.request_id;
                console.log('request_id', verifyRequestId, result);
                const data = {
                    token: uuidv4(),
                    code: (process.env.ENVIRONMNENT == 'dev') ? '123456' : this.accountService.getNumberCode(),
                    name: ACTIVATION_REQUEST_TYPE.ACCOUNT_ACTIVATION,
                    data: verifyRequestId,
                    phone: (process.env.ENVIRONMNENT == 'dev')? '+2348152229733' : req.body.international_phone_number,
                    platform: 'vonage'
                };
                await this.loginSessionService.updateMany({phone: req.body.international_phone_number, status: 0}, {status: 1});
                this.loginSessionService.create(data)
                    .then((activation) => {
                        this.requestService.addToDataBag(ACTIVATION_CODE_LABEL, activation);
                        this.requestService.addToDataBag(SMS_VERIFICATION_LABEL, result);
                        next();
                    })
                    .catch((err) => {
                        console.log(err);
                        const message = Object.assign({}, this.responseMessage.UNABLE_COMPLETE_REQUEST, {message: 'Verify Service unavailable. try again'})
                        return this.logAndSendErrorResponseObject(res, err, message, 400);
                        //next();
                    })
            }
        });
    }

    public getActivationTokenFromBodyIdForTwilio = (req, res, next) => {
        const token = req.body.token_id;
        // console.log(req.body)
        if (!token){
            return this.logAndSendErrorResponseObject(res, {}, this.responseMessage.INVALID_REQUEST, 400);
        }
        console.log(token)
        this.loginSessionService.findOneActive({_id: token, data: {$ne: null}})
            .then((activation) => {
                this.requestService.addToDataBag(ACTIVATION_CODE_LABEL, activation);
                next();
            })
            .catch((err) => {
                next();
            })
    }

    public verifyOTPTwilioAndOther = async (req, res, next) => {
        const code = req.body.code;
        let activationCode: IActivationCode = this.requestService.getFromDataBag(ACTIVATION_CODE_LABEL);
        console.log("Act", activationCode)
        if (activationCode.platform == 'vonage') {
            console.log('verifying vonage');
            try {
                const Vonage = require('@vonage/server-sdk');
                const vonage = new Vonage({
                    apiKey: process.env.VONAGE_API_KEY,
                    apiSecret: process.env.VONAGE_SECRET
                });
                vonage.verify.check({
                    request_id: activationCode.data,
                    code: code
                }, async (err, result) => {
                    if (err) {
                        return this.logAndSendErrorResponseObject(res, err, this.responseMessage.INCORRECT_OTP, 400);
                    } else {
                        console.log(result);
                        await this.loginSessionService.updateStatus(activationCode._id);
                        next();
                    }
                });
            } catch (e) {
                this.logger.log(e);
                return this.logAndSendErrorResponseObject(res, {}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400);
            }
        } else if (activationCode.platform == 'twilio') {
            try {
                console.log('verifying twilio')
                const verification: any = await this.twilioService.verify({
                    sid: activationCode.data,
                    phone: (process.env.ENVIRONMNENT == 'dev')? '+2348152229733' : req.body.international_phone_number,
                    code: code
                });
                console.log(req.body, verification, activationCode);
                if (verification.status == 'approved') {
                    await this.loginSessionService.updateStatus(activationCode._id);
                    next();
                } else {
                    return this.logAndSendErrorResponseObject(res, {}, this.responseMessage.INCORRECT_OTP, 400);
                }
            } catch (e) {
                this.logger.log(e);
                return this.logAndSendErrorResponseObject(res, {}, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400);
            }
        } else {
            if (activationCode.data === code) {
                await this.loginSessionService.updateStatus(activationCode._id);
                next();
            } else {
                return this.logAndSendErrorResponseObject(res, {}, this.responseMessage.INCORRECT_OTP, 400);
            }
        }

    }

}

export default UserMiddleware;
