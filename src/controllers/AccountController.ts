import BaseController from "./base controllers/BaseController";
import { IUser } from "../models/user/user";
import DateOfBirthService from "../services/DateOfBirthService";
import { ILoginSession } from "../models/user/login_session";
import { Response } from "express";
import LoginSessionService from "../services/LoginSessionService";
import { BIT, USER_STATUS } from "../common/constants/AppConstants";



class AccountController extends BaseController {

    private dateOfBirthService: DateOfBirthService;
    private loginSessionService: LoginSessionService;

    constructor() {
        super();
    }

    initRoutes() {
        this.signUp();
        this.login();
        this.preLogin();
        this.login2fa();
        this.resendOTP();
        this.logout();
    }

    protected initServices() {
        this.dateOfBirthService = new DateOfBirthService();
        this.loginSessionService = new LoginSessionService();
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
        this.router.post("/pre-login",
            this.userMiddleWare.loadUserToRequest,
            this.userMiddleWare.checkUserStatus,
            // this.userMiddleWare.hashUserPassword,
            this.userMiddleWare.sendOTP,
        );
        this.router.post("/pre-login", (req, res) => {
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
        this.router.post("/login",
        this.userMiddleWare.loadUserToRequestByEmail,
        this.userMiddleWare.checkUserStatus,
        this.userMiddleWare.validatePassword
        );
        this.router.post("/login", (req, res) => {
            const user = this.requestService.getUser();
            this.loginUser(user, res);
        });
    }


    signUp() {
        this.router.post('/signup',
        [
            this.userMiddleWare.ensureUniqueEmail,
            this.userMiddleWare.ensureUniquePhone,
            this.userMiddleWare.hashNewPassword
        ]);
        
        this.router.post("/signup", async (req, res) => {
            const body = req.body;
            const userData = {
                first_name: body.first_name,
                last_name: body.last_name,
                middle_name: body.middle_name,
                dob: body.dob,
                phone: body.phone.trim(),
                email: body.email.trim().toLowerCase(),
                password: body.password,
                phone_country_code: body.phone_country_code,
                country: body.country,
                address: body.address,
                status: USER_STATUS.ACTIVE
            };

            let session = null;
            try {
                session = await this.accountUtils.createMongooseTransaction();
                const user = await this.userService.save(userData, session);
                const dob = this.dateOfBirthService.createDOB(body.dob, user._id);
                const dateOfBirth = await this.dateOfBirthService.save(dob, session);
                user.date_of_birth = dateOfBirth._id;
                await user.save({session: session});
                await session.commitTransaction();
                await session.endSession();
                this.loginUser(user, res);

            } catch (error: any) {
                await session.abortTransaction();
                await session.endSession();
                this.sendErrorResponse(res, error, this.errorResponseMessage.UNABLE_TO_COMPLETE_REQUEST, 500);
            }

            

            // let session: ClientSession;
            // mongoose.startSession()
            //     .then(_session => {
            //         session = _session;
            //         session.startTransaction();
            //     })
            //     .then(async () => {
            //         try {
            //             const user = await this.userService.save(userData, session);
            //             const dob = this.dateOfBirthService.createDOB(body.dob, user._id);
            //             const dateOfBirth = await this.dateOfBirthService.save(dob, session);
            //             user.date_of_birth = dateOfBirth._id;
            //             await user.save({session: session});
            //             this.loginUser(user, res, session);

            //         } catch (error: any) {
            //             throw error;
            //         }
            //     })
            //     .catch(async (err) => {
            //         await session.abortTransaction();
            //         await session.endSession();
            //         this.sendErrorResponse(res, err, this.errorResponseMessage.UNABLE_TO_COMPLETE_REQUEST, 500);
            //     })
            // ;
        });
    }

    private async loginUser(user: IUser, res: Response ) {
        const authCode = this.accountUtils.generateUUIDV4();
        const loginSession = {
            uuid: authCode,
            user: user._id,
            status: BIT.ON
        };
        //logout user from other devices who's session hasn't expired yet
        this.logoutUser(user, res);

        this.loginSessionService.save(loginSession)
            .then(async (userSession) => {
                const token = this.accountUtils.createLoginToken(userSession);
                const response = {
                    message: this.successResponseMessage.LOGIN_SUCCESSFUL,
                    user: this.userService.getSafeUserData(user),
                    token: token
                }

                if (user.status == USER_STATUS.PENDING || user.status == USER_STATUS.SELF_DEACTIVATED) {
                    response.message = this.successResponseMessage.ACCOUNT_ACTIVATION_REQUIRED;
                }

                res.status(200).json(response);
            })
            .catch(async (err: Error) => {
                this.sendErrorResponse(res, err, this.errorResponseMessage.UNABLE_TO_LOGIN, 500);
            })
    }

    logout() {
        this.router.post("/logout", (req, res) => {
            const user = this.requestService.getUser();
            this.logoutUser(user, res);
        });
    }

    private async logoutUser(user: IUser, res: Response ) {

        try {
            const activeLoginSession = await this.loginSessionService.findOne({status: BIT.ON, user: user._id})
            if (activeLoginSession) {
                if (activeLoginSession.validity_end_date > new Date()) {
                    activeLoginSession.logged_out = true;
                    activeLoginSession.validity_end_date = new Date();
                } else {
                    activeLoginSession.expired = true
                }
                activeLoginSession.status = BIT.OFF;
                await activeLoginSession.save();
            }
        } catch (error: any) {
            this.sendErrorResponse(res, error, this.errorResponseMessage.UNABLE_TO_COMPLETE_REQUEST, 500);

        }
      
    }
}
export default new AccountController().router;
