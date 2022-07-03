/* eslint-disable @typescript-eslint/no-empty-function */
import express from 'express';
import AccountService from '../services/AccountService'
import UserMiddleware from "../middlewares/user/UserMiddleware";
import UserService from "../../services/UserService";
import RequestService from "../../services/RequestService";
import ValidatorService from "../../services/ValidatorService";
import {SYS_USER_GROUP} from '../../constants/AppConstants';
import BaseResponseHandler from "../BaseResponseHandler";
import LoggerService from "../../services/LoggerService";
import {ISysUser} from "../../models/sys_user";
import {IUser} from '../../models/user';
import {IRole} from '../../models/role';
import RoleService from '../../services/RoleService';
import AuthMiddleware from '../../middlewares/user/AuthMiddleware';
import SysAdminMiddleware from "../../middlewares/SysUserMiddleware";
import DateService from "../../services/DateService";

abstract class BaseAccountController extends BaseResponseHandler {

    public router;
    protected accountService: AccountService;
    protected userService: UserService;
    protected userMiddleWare: UserMiddleware;
    protected requestService: RequestService;
    protected validatorService: ValidatorService;
    protected logger: LoggerService;
    protected roleService: RoleService;
    protected authMiddleware: AuthMiddleware;
    protected sysAdminMiddleWare: SysAdminMiddleware;
    protected dateService: DateService;


    constructor() {
        super();
        this.init();
        this.router = express.Router();
        this.accountService = new AccountService();
        this.userService = new UserService();
        this.userMiddleWare = new UserMiddleware(this.router);
        this.requestService = new RequestService(this.router);
        this.authMiddleware = new AuthMiddleware(this.router);
        this.logger = new LoggerService();
        this.roleService = new RoleService();
        this.sysMiddleWare = new SysUserMiddleware(this.router);//replaced by the one below
        this.sysAdminMiddleWare = new SysAdminMiddleware(this.router);
        this.dateService = new DateService();
        this.initServices();
        this.initMiddleware();
        this.initRoutes();
    }
    // protected abstract init():void; 
    protected abstract initMiddleware():void;
    protected abstract initServices():void;
    protected abstract initRoutes():void;
    
    protected isSysManager() {
        const userSysUser: ISysUser = this.requestService.getFromDataBag('sys_user');
        return (SYS_USER_GROUP.SYSMANAGER === userSysUser.user_group);
    }

    protected getSysUser() {
        return this.requestService.getFromDataBag('sys_user');
    }

    protected logError(err:Error) {
        this.logger.error(err);
    }

    protected getSafeUserData(user:IUser) {
        return this.userService.getSafeUserData(user);
    }

    // protected async assignRole(body, roleName: string) {
    //     let role: IRole;
    //     role = await this.roleService.findByName(roleName);
    //     body.user_group = role.name;
    //     body.role = role._id;
    // }
}

export default BaseAccountController;
