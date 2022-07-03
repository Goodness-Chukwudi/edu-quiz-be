import BaseController from "./BaseController";
import { USER_STATUS } from '../../constants/AppConstants';
import mongoose, {ClientSession} from "mongoose";
import {IUser} from "../../models/user";


class AccountController extends BaseController {

    constructor() {
        super();
    }

    initRoutes() {
        this.signUp();
        this.preLogin();
        this.login2fa();
        this.login();
        this.resendOTP();
    }

    protected initServices() {
    }

    protected initMiddleware() {
        // super.initMiddleware();
    }

    resendOTP() {
        this.router.post('/otp/resend',
        this.userMiddleWare.loadUserToRequestByEmail,
        this.userMiddleWare.checkUserStatus,
        this.userMiddleWare.getTokenFromBody,
        );
        this.router.post('/otp/resend', (req, res) => {
            const user = this.requestService.getUser();
            const loginSession: ILoginSession = this.requestService.getFromDataBag(LOGIN_SESSION_LABEL);
            return this.sendSuccessResponse(res, {data: this.getSafeUserData(user), token: loginSession.token});
        })
    }

    preLogin() {
        this.router.post("/login",
            this.userMiddleWare.loadUserToRequest,
            this.userMiddleWare.checkUserStatus,
            // this.userMiddleWare.hashUserPassword,
            this.userMiddleWare.sendOTP,
        );
        this.router.post("/login", (req, res) => {
            const user = this.requestService.getUser();
            const safeUser = this.requestService.getSafeUser();
            const loginSession: ILoginSession = this.requestService.getFromDataBag(LOGIN_SESSION_LABEL);
            const password = req.body.password;

            if (user && user.password == password)  {
                switch(user.status) {
                    case USER_STATUS.PENDING : {
                        return this.sendSuccessResponse(res, {data: safeUser, token: loginSession.token});
                        break;
                    }
                    case USER_STATUS.ACTIVE : {
                        return this.sendSuccessResponse(res, {data: safeUser, token: loginSession.token});
                        break;
                    }
                    case USER_STATUS.SELF_DEACTIVATED : {
                        this.userService.activateUser(user)
                            .then((user:IUser) => {
                                return this.sendSuccessResponse(res, {data: safeUser, token: loginSession.token});
                            })
                            .catch((e: any) => {
                                return this.sendErrorResponse(res, e, this.responseMessage.ERROR, 400);
                            })
                        break;
                    }
                    case USER_STATUS.DEACTIVATED : {
                        return res.status(400).json(this.responseMessage.ACCOUNT_BLOCKED);
                        break;
                    }
                    default: {
                        res.status(400).json(this.responseMessage.ERROR);
                        break;
                    }
                }
            } else {
                return res.status(404).json(this.responseMessage.INVALID_LOGIN);
            }
        });
    }

    login2fa() {
        this.router.post("/login2fa",
            this.userMiddleWare.loadUserToRequest,
            this.userMiddleWare.checkUserStatus,
            // this.userMiddleWare.hashUserPassword,
            this.userMiddleWare.getTokenFromBody,
            this.userMiddleWare.verifyOTP
        );
        this.router.post("/login2fa", (req, res) => {
            const user = this.requestService.getUser();
            const password = req.body.password;
            if (user && user.password == password)  {
                return this.loginUser(user, res);
            } else {
                return res.status(404).json(this.responseMessage.INVALID_LOGIN);
            }
        });
    }

    login() {
        this.router.post("/login2faless",
        this.userMiddleWare.loadUserToRequest,
        this.userMiddleWare.checkUserStatus,
        // this.userMiddleWare.hashUserPassword,
        );
        this.router.post("/login2faless", (req, res) => {
            const user = this.requestService.getUser();
            const password = req.body.password;
            if (user && user.password == password)  {
                switch(user.status) {
                    case USER_STATUS.PENDING : {
                        return this.loginUser(user, res);
                        break;
                    }
                    case USER_STATUS.ACTIVE : {
                        return this.loginUser(user, res);
                        break;
                    }
                    case USER_STATUS.SELF_DEACTIVATED : {
                        this.userService.activateUser(user)
                            .then((user:IUser) => {
                                return this.loginUser(user, res);
                            })
                            .catch((err:Error) => {
                                return this.sendErrorResponse(res, err, this.responseMessage.ERROR, 400);
                            })
                        break;
                    }
                    case USER_STATUS.DEACTIVATED : {
                        return res.status(400).json(this.responseMessage.ACCOUNT_BLOCKED);
                        break;
                    }
                    default: {
                        res.status(400).json(this.responseMessage.ERROR);
                        break;
                    }
                }
            } else {
                return res.status(404).json(this.responseMessage.INVALID_LOGIN);
            }
        });
    }


    signUp() {
        this.router.post('/signup', this.userMiddleWare.validateEmailAndPhone);
        this.router.post("/signup", async (req, res) => {
            let session:ClientSession;

            mongoose.startSession()
                .then(_session => {
                    session = _session;
                    session.startTransaction();
                })
                .then(async () => {
                    try {
                        const body = req.body;
                        const userData = {
                            first_name: body.first_name,
                            last_name: body.last_name,
                            middle_name: body.last_name,
                            dob: body.dob,
                            phone: body.phone.trim().toLowerCase(),
                            email: body.email.trim().toLowerCase(),
                            password: body.hashedPassword,
                            phone_country_code: body.phone_country_code,
                            country: body.country,
                            address: body.address
                        };
                        const user:IUser = await this.userService.create(userData, session);
                        const dob = await this.dateOfBirthService.create(body.dob, user._id, session);// Create A date_of_birth schema for this that looks like setDob method
                        user.date_of_birth = dob;
                        await user.save({session: session});
                        return this.loginUser(user, res, session);
                    } catch (e) {
                        session.abortTransaction();
                        return this.sendErrorResponse(res, e, this.responseMessage.UNABLE_COMPLETE_REQUEST, 400);
                    }
                })
                .catch((err) => {
                    session.abortTransaction();
                    return this.sendErrorResponse(res, err, this.responseMessage.SERVER_ERROR, 500);
                })
            ;
        });
    }

    private async loginUser(user:IUser, res:any, session:any = null ) {
        const authCode = this.accountService.generateUUIDV4();
        const loginSession:ILoginSession = {
            uuid: authCode,
            user: user._id,
            from: Date.now()
        };
//Deactivate any active sessions
        this.loginSessionService.create(loginSession, session)
            .then(async (userSession) => {
                user.password = undefined;
                const token = this.accountService.createToken(userSession);
                await session.commitTransaction();
                await session.endSession();
                if (user.status == USER_STATUS.ACTIVE) {
                    return res.json(Object.assign({}, this.responseMessage.SUCCESS, {
                        user: user,
                        token: token,
                    }));
                } else if (user.status == USER_STATUS.PENDING) {
                    return res.json(Object.assign({}, this.responseMessage.ACTIVATION_REQUIRED, {
                        user: user,
                        token: token,
                    }));
                }

            })
            .catch((err: Error) => {
                return this.logAndSendErrorResponseObject(res, err, this.responseMessage.ERROR, 400);
            })
    }
}
export default new AccountController().router;
